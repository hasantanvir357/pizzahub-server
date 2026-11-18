import express from 'express';
import { ObjectId } from 'mongodb';
import { usersCollection } from '../config/db.js';
import { verifyToken } from '../middlewares/verifyToken.js';
import { verifyRole } from '../middlewares/verifyRole.js';

const router = express.Router();

// 1. Admin: Get All Users
router.get('/', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const users = await usersCollection
      .find({}, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .toArray();
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// 2. Admin: Update User Role
router.patch('/:id/role', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    if (!['customer', 'vendor', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    await usersCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { role } });
    res.json({ message: `User role updated to ${role}` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update user role' });
  }
});

// 3. Any Logged-in User: Update Own Profile
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

export default router;
