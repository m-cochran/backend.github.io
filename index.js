const express = require('express');
const cors = require('cors');
const stripe = require('stripe')('sk_test_51PulULDDaepf7cji2kqbdFVOzF37bS8RrtgO8dpVBpT1m8AXZhcyIBAAf42VOcpE8auFxbm1xSjglmBhvaIYaRck00QkUGMkpF'); // Your Stripe secret key
const app = express();
const endpointSecret = 'whsec_eHnMf6JWb1VK4Bmn9yO77d8nazu5yKvs'; // Your webhook secret from Stripe

// Middleware for handling CORS and JSON (for non-webhook routes)
app.use(cors({
  origin: 'https://m-cochran.github.io', // Allow requests from your GitHub Pages site
  methods: ['POST'],
  allowedHeaders: ['Content-Type']
}));

// Body parsing middleware for non-webhook routes
app.use((req, res, next) => {
  if (req.originalUrl === '/api/webhook') {
    next(); // Skip JSON body parsing for webhook route
  } else {
    express.json()(req, res, next); // Parse JSON for other routes
  }
});

// Webhook endpoint to receive events from Stripe
app.post('/api/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    // Verify the webhook signature to ensure the request came from Stripe
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.log(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event based on its type
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      const charge = paymentIntent.charges.data[0];
      const receiptUrl = charge.receipt_url;

      console.log(`Payment successful! Receipt URL: ${receiptUrl}`);
      // You can now do something with the receipt URL, like send it via email or display it on a thank you page.
      break;

    // Handle other event types as needed
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  // Return a response to acknowledge receipt of the event
  res.json({ received: true });
});

// Example route to create a PaymentIntent (for demonstration purposes)
app.post('/api/create-payment-intent', async (req, res) => {
  const { amount, receipt_email } = req.body;

  // Check if amount is valid
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  try {
    // Create a payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Stripe works in cents, so multiply by 100
      currency: 'usd',
      receipt_email: receipt_email // Pass the receipt email from the request body
    });

    // Confirm payment intent
    const confirmedPaymentIntent = await stripe.paymentIntents.confirm(paymentIntent.id);

    // Retrieve the receipt URL from the charge
    const chargeId = confirmedPaymentIntent.charges.data[0].id;
    const charge = await stripe.charges.retrieve(chargeId);

    res.status(200).json({
      clientSecret: confirmedPaymentIntent.client_secret,
      receiptUrl: charge.receipt_url // Retrieve receipt URL from charge
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
