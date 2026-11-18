import express from 'express';
import { ObjectId } from 'mongodb';
import { ordersCollection, transactionsCollection, menuItemsCollection, usersCollection } from '../config/db.js';
import { verifyToken } from '../middlewares/verifyToken.js';
import { verifyRole } from '../middlewares/verifyRole.js';

const router = express.Router();

// 1. Customer: Place New Order & Record Transaction
router.post('/', verifyToken, async (req, res) => {
  try {
    const { menuId, quantity, size, deliveryAddress, phone, paymentMethod } = req.body;

    if (!menuId || !quantity || !deliveryAddress || !phone) {
      return res.status(400).json({ message: 'Please fill all delivery and order fields' });
    }

    const menuItem = await menuItemsCollection.findOne({ _id: new ObjectId(menuId) });
    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    const qty = Math.max(1, parseInt(quantity, 10));
    const sizeMultiplier = size === 'Large' ? 1.4 : size === 'Medium' ? 1.2 : 1;
    const totalPrice = Number((menuItem.price * sizeMultiplier * qty).toFixed(2));

    const newOrder = {
      customerId: req.user._id,
      customerName: req.user.name,
      customerEmail: req.user.email,
      vendorId: menuItem.vendorId,
      restaurantName: menuItem.restaurantName,
      menuId: menuItem._id.toString(),
      pizzaName: menuItem.name,
      pizzaImage: menuItem.image,
      size: size || 'Regular',
      quantity: qty,
      totalPrice,
      deliveryAddress,
      phone,
      status: 'pending', // pending -> preparing -> delivered -> cancelled
      createdAt: new Date(),
    };

    const orderResult = await ordersCollection.insertOne(newOrder);

    // Record Payment / Transaction
    const transaction = {
      orderId: orderResult.insertedId.toString(),
      customerId: req.user._id,
      customerEmail: req.user.email,
      vendorId: menuItem.vendorId,
      amount: totalPrice,
      paymentMethod: paymentMethod || 'Cash on Delivery',
      transactionId: `TXN-${Date.now()}`,
      status: paymentMethod === 'Card / Online' ? 'paid' : 'pending',
      createdAt: new Date(),
    };

    await transactionsCollection.insertOne(transaction);

    res.status(201).json({
      message: 'Order placed successfully!',
      orderId: orderResult.insertedId,
      transactionId: transaction.transactionId,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to place order', error: error.message });
  }
});

// 2. Customer: Get My Orders
router.get('/my-orders', verifyToken, async (req, res) => {
  try {
    const orders = await ordersCollection.find({ customerId: req.user._id }).sort({ createdAt: -1 }).toArray();
    res.json({ orders });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

// 3. Vendor: Get Incoming Orders for Vendor's Kitchen
router.get('/vendor-orders', verifyToken, verifyRole('vendor', 'admin'), async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { vendorId: req.user._id };
    const orders = await ordersCollection.find(query).sort({ createdAt: -1 }).toArray();
    res.json({ orders });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch vendor orders' });
  }
});

// 4. Vendor / Admin: Update Order Status
router.patch('/:id/status', verifyToken, verifyRole('vendor', 'admin'), async (req, res) => {
  try {
    const { status } = req.body;
    await ordersCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { status } });
    res.json({ message: `Order status updated to ${status}` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update order status' });
  }
});

// 5. Role-Based Dashboard Overview Stats & Chart Data
router.get('/dashboard-stats', verifyToken, async (req, res) => {
  try {
    const role = req.user.role;

    if (role === 'admin') {
      const [totalUsers, totalMenus, allOrders] = await Promise.all([
        usersCollection.countDocuments(),
        menuItemsCollection.countDocuments(),
        ordersCollection.find({}).toArray(),
      ]);
      const totalRevenue = allOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);

      return res.json({
        stats: {
          totalUsers,
          totalMenus,
          totalOrders: allOrders.length,
          totalRevenue: Number(totalRevenue.toFixed(2)),
        },
        recentOrders: allOrders.slice(0, 5),
      });
    }

    if (role === 'vendor') {
      const [myMenus, myOrders] = await Promise.all([
        menuItemsCollection.countDocuments({ vendorId: req.user._id }),
        ordersCollection.find({ vendorId: req.user._id }).sort({ createdAt: -1 }).toArray(),
      ]);
      const totalEarnings = myOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);

      return res.json({
        stats: {
          myMenus,
          totalOrders: myOrders.length,
          pendingOrders: myOrders.filter((o) => o.status === 'pending').length,
          totalEarnings: Number(totalEarnings.toFixed(2)),
        },
        recentOrders: myOrders.slice(0, 5),
      });
    }

    // Customer Stats
    const myOrders = await ordersCollection.find({ customerId: req.user._id }).sort({ createdAt: -1 }).toArray();
    const totalSpent = myOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);

    res.json({
      stats: {
        totalOrders: myOrders.length,
        activeOrders: myOrders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').length,
        totalSpent: Number(totalSpent.toFixed(2)),
      },
      recentOrders: myOrders.slice(0, 5),
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load dashboard stats' });
  }
});

export default router;
