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
    if (!password || password.length < 6 || !/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
      return res
        .status(400)
        .json({ message: 'Password must be at least 6 characters with 1 uppercase and 1 lowercase letter.' });
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

    const token = jwt.sign(userPayload, process.env.JWT_SECRET, { expiresIn: '30d' });

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

    const token = jwt.sign(userPayload, process.env.JWT_SECRET, { expiresIn: '30d' });

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

// 4. Google Sign-In / Sign-Up (find or create user; default role: 'customer')
router.post('/google', async (req, res) => {
  try {
    let { email, name, image, googleId, idToken } = req.body;

    // If a Google ID token is provided, verify it with Google before trusting the payload.
    if (idToken) {
      const tokenInfoRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
      );
      if (!tokenInfoRes.ok) {
        return res.status(401).json({ message: 'Invalid Google ID token' });
      }
      const tokenInfo = await tokenInfoRes.json();

      const expectedAud = process.env.GOOGLE_CLIENT_ID;
      if (expectedAud && tokenInfo.aud !== expectedAud) {
        return res.status(401).json({ message: 'Google token audience mismatch' });
      }
      if (tokenInfo.email_verified === 'false') {
        return res.status(401).json({ message: 'Google email is not verified' });
      }

      email = tokenInfo.email;
      name = tokenInfo.name || name;
      image = tokenInfo.picture || image;
      googleId = tokenInfo.sub;
    }

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const normalizedEmail = email.toLowerCase();
    const existingUser = await usersCollection.findOne({ email: normalizedEmail });

    let user;
    if (existingUser) {
      // Existing account: preserve their role/plan and enforce the block status.
      if (existingUser.isBlocked === true) {
        return res.status(403).json({ message: 'Your account has been blocked by Admin.' });
      }
      if (googleId && !existingUser.googleId) {
        await usersCollection.updateOne({ _id: existingUser._id }, { $set: { googleId } });
      }
      user = existingUser;
    } else {
      const newUser = {
        name: name || normalizedEmail.split('@')[0],
        email: normalizedEmail,
        password: null, // Google accounts have no password
        role: 'customer',
        restaurantName: null,
        image: image || '',
        googleId: googleId || null,
        createdAt: new Date(),
      };
      const result = await usersCollection.insertOne(newUser);
      user = { ...newUser, _id: result.insertedId };
    }

    const userPayload = {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      restaurantName: user.restaurantName || null,
      image: user.image || '',
    };

    const token = jwt.sign(userPayload, process.env.JWT_SECRET, { expiresIn: '30d' });

    res.json({ token, user: userPayload });
  } catch (error) {
    res.status(500).json({ message: 'Google sign-in failed', error: error.message });
  }
});

export default router;
