import express from 'express';
import { ObjectId } from 'mongodb';
import Stripe from 'stripe';
import { usersCollection, transactionsCollection } from '../config/db.js';
import { verifyToken } from '../middlewares/verifyToken.js';
import { verifyRole } from '../middlewares/verifyRole.js';

const router = express.Router();
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// 1. Admin: Get All Users (deduplicated by lowercase email, keeping the highest-privilege account)
router.get('/', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const users = await usersCollection
      .find({}, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    // Deduplicate by email (case-insensitive) keeping the highest-privilege account.
    const rolePriority = { admin: 3, vendor: 2, customer: 1 };
    const usersByEmail = new Map();

    for (const user of users) {
      const emailKey = (user.email || '').toLowerCase();
      const existing = usersByEmail.get(emailKey);
      if (!existing) {
        usersByEmail.set(emailKey, user);
        continue;
      }
      const existingPriority = rolePriority[existing.role] || 0;
      const userPriority = rolePriority[user.role] || 0;
      if (userPriority > existingPriority) {
        usersByEmail.set(emailKey, user);
      }
    }

    const dedupedUsers = Array.from(usersByEmail.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    res.json({ users: dedupedUsers });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// 2. Admin: Update User Role (admins cannot demote themselves)
router.patch('/:id/role', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    if (!['customer', 'vendor', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    if (String(req.user._id) === String(req.params.id)) {
      return res.status(400).json({ message: 'Admins cannot change their own role' });
    }

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { role } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: `User role updated to ${role}` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update user role' });
  }
});

// 3. Admin: Block / Unblock a User (admins cannot block themselves)
router.patch('/:id/block', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const { isBlocked } = req.body;
    if (typeof isBlocked !== 'boolean') {
      return res.status(400).json({ message: 'isBlocked must be a boolean' });
    }

    if (String(req.user._id) === String(req.params.id)) {
      return res.status(400).json({ message: 'Admins cannot block themselves' });
    }

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { isBlocked } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: isBlocked ? 'User blocked' : 'User unblocked', isBlocked });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update block status' });
  }
});

// 4. Any Logged-in User: Update Own Profile
router.patch('/profile', verifyToken, async (req, res) => {
  try {
    const { name, restaurantName, image } = req.body;
    const updateFields = {};
    if (name) updateFields.name = name;
    if (restaurantName) updateFields.restaurantName = restaurantName;
    if (image) updateFields.image = image;

    await usersCollection.updateOne({ _id: new ObjectId(req.user._id) }, { $set: updateFields });

    const updatedUser = await usersCollection.findOne(
      { _id: new ObjectId(req.user._id) },
      { projection: { password: 0 } }
    );
    res.json({ message: 'Profile updated', user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// 5. Vendor: Create Stripe Checkout Session to Upgrade to Premium ($19.99)
router.post('/create-checkout-session', verifyToken, verifyRole('vendor'), async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ message: 'Stripe is not configured on the server' });
    }

    const user = await usersCollection.findOne({ _id: new ObjectId(req.user._id) });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'PizzaHub Premium Plan' },
            unit_amount: 1999, // $19.99
          },
          quantity: 1,
        },
      ],
      success_url: `${CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CLIENT_URL}/payment/cancel`,
      customer_email: user.email,
      metadata: { userId: user._id.toString(), email: user.email },
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({ message: err.message || 'Failed to create checkout session' });
  }
});

// 6. Admin: Get All Transactions (read-only, newest first)
router.get('/transactions', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const transactions = await transactionsCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    res.json({ transactions });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch transactions' });
  }
});

export default router;
