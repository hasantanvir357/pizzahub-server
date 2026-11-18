import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { usersCollection } from '../config/db.js';
import { verifyToken } from '../middlewares/verifyToken.js';

const router = express.Router();

// 1. Register (Customer or Vendor only)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, restaurantName, image } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    // Security check: Block self-assigning admin role
    const safeRole = role === 'vendor' ? 'vendor' : 'customer';

    const existingUser = await usersCollection.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: safeRole,
      restaurantName: safeRole === 'vendor' ? restaurantName || name : null,
      image: image || '',
      createdAt: new Date(),
    };

    const result = await usersCollection.insertOne(newUser);
    const userPayload = {
      _id: result.insertedId.toString(),
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      restaurantName: newUser.restaurantName,
      image: newUser.image,
    };

    const token = jwt.sign(userPayload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, user: userPayload });
  } catch (error) {
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

// 2. Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await usersCollection.findOne({ email: email?.toLowerCase() });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Blocked accounts cannot sign in. Checked after the password match so the
    // block status is never leaked for wrong credentials.
    if (user.isBlocked === true) {
      return res.status(403).json({ message: 'Your account has been blocked by Admin.' });
    }

    const userPayload = {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      restaurantName: user.restaurantName || null,
      image: user.image || '',
    };

    const token = jwt.sign(userPayload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user: userPayload });
  } catch (error) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

// 3. Get Current Logged-in User Profile
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await usersCollection.findOne({ _id: new ObjectId(req.user._id) }, { projection: { password: 0 } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch user', error: error.message });
  }
});

export default router;
