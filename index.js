import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import { ObjectId } from 'mongodb';
import 'dotenv/config';
import { connectDB, usersCollection, transactionsCollection } from './config/db.js';
import { seedMenuIfEmpty } from './utils/seedMenu.js';
import authRoutes from './routes/authRoutes.js';
import menuRoutes from './routes/menuRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import userRoutes from './routes/userRoutes.js';

const app = express();
const port = process.env.PORT || 5000;
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

app.use(
  cors({
    origin: [process.env.CLIENT_URL, 'http://localhost:3000'],
    credentials: true,
  })
);

// Stripe Webhook: mounted BEFORE express.json() so the raw request body is
// preserved for signature verification via the Stripe-Signature header.
app.post('/api/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ message: 'Stripe webhook is not configured' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error('Stripe signature verification failed:', error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  // On successful checkout, upgrade the vendor to Premium and record the payment.
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const vendorId = session.metadata?.vendorId;

    try {
      if (vendorId && ObjectId.isValid(vendorId)) {
        const vendor = await usersCollection.findOne({ _id: new ObjectId(vendorId) });

        await usersCollection.updateOne(
          { _id: new ObjectId(vendorId) },
          { $set: { subscriptionPlan: 'premium' } }
        );

        await transactionsCollection.insertOne({
          vendorId,
          vendorName: vendor?.name || vendor?.restaurantName || 'Unknown Vendor',
          plan: 'Premium',
          amount: 19.99,
          currency: 'USD',
          stripeSessionId: session.id,
          status: 'paid',
          createdAt: new Date(),
        });
      }
    } catch (error) {
      console.error('Failed to process checkout.session.completed:', error.message);
    }
  }

  res.json({ received: true });
});

app.use(express.json());

// Connect to MongoDB & Seed 12 Initial Menu Items
connectDB().then(() => {
  seedMenuIfEmpty();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);

app.get('/', (req, res) => {
  res.send('PizzaHub Server is running!');
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
