import express from 'express';
import { ObjectId } from 'mongodb';
import { menuItemsCollection, usersCollection } from '../config/db.js';
import { verifyToken } from '../middlewares/verifyToken.js';
import { verifyRole } from '../middlewares/verifyRole.js';

const router = express.Router();

// 1. Public: Get Approved Menu Items (with Search, Category, Location, Sort & Limit)
router.get('/', async (req, res) => {
  try {
    const { search, category, location, sort, limit } = req.query;

    // Public requests only ever see approved items that are still active.
    // `$ne: false` keeps legacy items (without an explicit flag) visible while
    // hiding anything a vendor/admin has explicitly deactivated.
    const query = {
      status: 'approved',
      isActive: { $ne: false },
      active: { $ne: false },
    };

    if (category && String(category).toLowerCase() !== 'all') {
      query.category = category;
    }

    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      query.$or = [
        { itemName: searchRegex },
        { name: searchRegex },
        { description: searchRegex },
        { restaurantName: searchRegex },
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

    // Free plan limit: vendors without a premium subscription can keep up to
    // 3 non-rejected items. Admins are exempt from the limit.
    if (req.user.role === 'vendor') {
      const vendor = await usersCollection.findOne({ _id: new ObjectId(req.user._id) });
      if (!vendor || vendor.subscriptionPlan !== 'premium') {
        const itemCount = await menuItemsCollection.countDocuments({
          vendorId: req.user._id,
          status: { $ne: 'rejected' },
        });
        if (itemCount >= 3) {
          return res.status(403).json({
            message: 'Free plan allows up to 3 active items. Upgrade to Premium for unlimited items!',
          });
        }
      }
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

// 6. Customer: Add a Review to a Menu Item
router.post('/:id/reviews', verifyToken, verifyRole('customer'), async (req, res) => {
  try {
    const { rating, comment } = req.body;

    if (!rating || !comment) {
      return res.status(400).json({ message: 'Rating and comment are required' });
    }

    const ratingValue = Number(rating);
    if (!ratingValue || ratingValue < 1 || ratingValue > 5) {
      return res.status(400).json({ message: 'Rating must be a number between 1 and 5' });
    }

    const review = {
      userId: req.user._id,
      userName: req.user.name,
      rating: ratingValue,
      comment,
      createdAt: new Date(),
    };

    const result = await menuItemsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $push: { reviews: review } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    res.status(201).json({ message: 'Review added', review });
  } catch (error) {
    res.status(400).json({ message: 'Invalid menu ID' });
  }
});

export default router;
