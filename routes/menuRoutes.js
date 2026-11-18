import express from 'express';
import { ObjectId } from 'mongodb';
import { menuItemsCollection } from '../config/db.js';
import { verifyToken } from '../middlewares/verifyToken.js';
import { verifyRole } from '../middlewares/verifyRole.js';

const router = express.Router();

// 1. Public: Get Approved Menu Items (with Search, Category, Sort & Limit)
router.get('/', async (req, res) => {
  try {
    const { search, category, sort, limit } = req.query;
    const query = { status: 'approved' };

    if (category && category !== 'All') {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { restaurantName: { $regex: search, $options: 'i' } },
      ];
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'price_asc') sortOption = { price: 1 };
    if (sort === 'price_desc') sortOption = { price: -1 };

    let cursor = menuItemsCollection.find(query).sort(sortOption);
    if (limit) cursor = cursor.limit(parseInt(limit, 10));

    const items = await cursor.toArray();
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load menu', error: error.message });
  }
});

// 2. Public: Get Single Menu Item Details
router.get('/:id', async (req, res) => {
  try {
    const item = await menuItemsCollection.findOne({ _id: new ObjectId(req.params.id) });
    if (!item) return res.status(404).json({ message: 'Menu item not found' });
    res.json({ item });
  } catch (error) {
    res.status(400).json({ message: 'Invalid menu ID' });
  }
});

// 3. Vendor: Add New Menu Item (Starts as 'pending' until Admin approves)
router.post('/', verifyToken, verifyRole('vendor', 'admin'), async (req, res) => {
  try {
    const { name, description, price, category, image, toppings } = req.body;
    if (!name || !price || !category || !image) {
      return res.status(400).json({ message: 'All required fields must be filled' });
    }

    const newItem = {
      name,
      description: description || '',
      price: parseFloat(price),
      category,
      image,
      toppings: Array.isArray(toppings) ? toppings : [],
      vendorId: req.user._id,
      vendorEmail: req.user.email,
      restaurantName: req.user.restaurantName || req.user.name,
      status: req.user.role === 'admin' ? 'approved' : 'pending',
      createdAt: new Date(),
    };

    const result = await menuItemsCollection.insertOne(newItem);
    res.status(201).json({ message: 'Menu item submitted', insertedId: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: 'Failed to add menu item', error: error.message });
  }
});

// 4. Vendor: Get Own Menu Items
router.get('/vendor/my-items', verifyToken, verifyRole('vendor', 'admin'), async (req, res) => {
  try {
    const items = await menuItemsCollection.find({ vendorId: req.user._id }).sort({ createdAt: -1 }).toArray();
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch vendor items' });
  }
});

// 5. Admin: Get All Menu Items (Pending + Approved) & Approve/Delete
router.get('/admin/all', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const items = await menuItemsCollection.find({}).sort({ createdAt: -1 }).toArray();
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch all menus' });
  }
});

router.patch('/:id/status', verifyToken, verifyRole('admin'), async (req, res) => {
  try {
    const { status } = req.body; // 'approved' or 'rejected'
    await menuItemsCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { status } });
    res.json({ message: `Menu status updated to ${status}` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update status' });
  }
});

router.delete('/:id', verifyToken, verifyRole('vendor', 'admin'), async (req, res) => {
  try {
    await menuItemsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ message: 'Menu item deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete item' });
  }
});

export default router;
