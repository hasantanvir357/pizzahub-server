import express from 'express';
import { ObjectId } from 'mongodb';
import { ordersCollection, transactionsCollection, menuItemsCollection, usersCollection } from '../config/db.js';
import { verifyToken } from '../middlewares/verifyToken.js';
import { verifyRole } from '../middlewares/verifyRole.js';

const router = express.Router();

// Seeded menu items can lack a `vendorId` — resolve the owning vendor through
// their `restaurantName` so every order is linked to the right kitchen.
async function resolveVendorId(menuItem) {
  if (menuItem.vendorId) return String(menuItem.vendorId);
  if (!menuItem.restaurantName) return null;

  const vendor = await usersCollection.findOne({
    restaurantName: menuItem.restaurantName,
    role: 'vendor',
  });
  return vendor ? vendor._id.toString() : null;
}

// Vendor order lookup: matches by `vendorId` and also legacy orders that were
// saved without one and only carry the restaurant name.
function vendorOrdersQuery(user) {
  const or = [{ vendorId: user._id }];
  if (user.restaurantName) {
    or.push({ restaurantName: user.restaurantName, vendorId: null });
  }
  return { $or: or };
}

// 1. Customer: Place New Order & Record Transaction
// Unauthenticated requests are rejected with a customer-specific 401 before
// the bearer token is verified; only customer accounts may place orders.
router.post(
  '/',
  async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Please sign in as a customer to place an order.' });
    }
    next();
  },
  verifyToken,
  async (req, res) => {
    try {
      // Only customers are allowed to place orders.
      if (req.user.role !== 'customer') {
        return res.status(403).json({
          message: 'Only Customer accounts can place orders. Vendors and Admins cannot place food orders.',
        });
      }

      const { quantity, size, paymentMethod } = req.body;
      // Accept any of the field names used by the different clients.
      const menuId = req.body.menuId || req.body.menuItemId || req.body.pizzaId;
      const deliveryAddress = req.body.deliveryAddress || req.body.address;
      const phone = req.body.phone || req.body.customerPhone;
      const bodyTotalPrice = req.body.totalPrice ?? req.body.price;

      if (!menuId || !quantity || !deliveryAddress || !phone) {
        return res.status(400).json({ message: 'Please fill all delivery and order fields' });
      }

      if (!ObjectId.isValid(menuId)) {
        return res.status(400).json({ message: 'Invalid menu item id' });
      }

      const menuItem = await menuItemsCollection.findOne({ _id: new ObjectId(menuId) });

      // Prefer details supplied by the client; otherwise look them up by menu ID.
      const pizzaName = req.body.pizzaName || req.body.name || menuItem?.name;
      const pizzaImage = req.body.pizzaImage || req.body.image || menuItem?.image;

      if (!pizzaName || !pizzaImage) {
        return res.status(404).json({ message: 'Menu item not found' });
      }

      const qty = Math.max(1, parseInt(quantity, 10));
      const sizeMultiplier = size === 'Large' ? 1.4 : size === 'Medium' ? 1.2 : 1;
      const computedTotal = menuItem?.price != null
        ? Number((menuItem.price * sizeMultiplier * qty).toFixed(2))
        : 0;
      const parsedBodyTotal = Number(bodyTotalPrice);
      // Use the client's total when supplied (and valid), else compute it from the menu price.
      const totalPrice =
        bodyTotalPrice != null && bodyTotalPrice !== '' && Number.isFinite(parsedBodyTotal)
          ? Number(parsedBodyTotal.toFixed(2))
          : computedTotal;

      const vendorId = menuItem ? await resolveVendorId(menuItem) : req.body.vendorId || null;

      const newOrder = {
        customerId: req.user._id,
        customerName: req.user.name,
        customerEmail: req.user.email,
        vendorId,
        restaurantName: menuItem?.restaurantName || req.body.restaurantName || null,
        menuId: menuItem ? menuItem._id.toString() : menuId,
        pizzaName,
        pizzaImage,
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
        vendorId,
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
  }
);

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
    // Legacy orders saved without a vendorId are still matched through the
    // restaurant name, so vendors always see every order on their items.
    const query = req.user.role === 'admin' ? {} : vendorOrdersQuery(req.user);
    const orders = await ordersCollection.find(query).sort({ createdAt: -1 }).toArray();
    res.json({ orders });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch vendor orders' });
  }
});

// 4. Vendor / Admin: Update Order Status
router.patch('/:id/status', verifyToken, verifyRole('vendor', 'admin'), async (req, res) => {
  try {
    const { status, cancelReason } = req.body;
    const update = { status };

    if (status === 'cancelled') {
      update.cancelReason = cancelReason || 'Cancelled by the kitchen';
      update.cancelledBy = req.user.role;
    }

    await ordersCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: update });
    res.json({ message: `Order status updated to ${status}` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update order status' });
  }
});

// 5. Customer (own pending order) / Vendor / Admin: Cancel Order
router.patch('/:id/cancel', verifyToken, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid order id' });
    }

    const order = await ordersCollection.findOne({ _id: new ObjectId(req.params.id) });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ message: 'Order is already cancelled' });
    }

    const isCustomer = String(order.customerId) === String(req.user._id);
    const isVendor = order.vendorId != null && String(order.vendorId) === String(req.user._id);
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin && !isVendor && !isCustomer) {
      return res.status(403).json({ message: 'Not authorized to cancel this order' });
    }

    // Customers may only cancel while the order is still pending.
    if (!isAdmin && !isVendor && order.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending orders can be cancelled' });
    }

    const { cancelReason } = req.body;
    await ordersCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          status: 'cancelled',
          cancelReason: cancelReason || 'No reason provided',
          cancelledBy: req.user.role,
        },
      }
    );

    res.json({ message: 'Order cancelled successfully', status: 'cancelled' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to cancel order', error: error.message });
  }
});

// 6. Role-Based Dashboard Overview Stats & Chart Data
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
        ordersCollection
          .find({ ...vendorOrdersQuery(req.user), hiddenForVendor: { $ne: true } })
          .sort({ createdAt: -1 })
          .toArray(),
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

    // Customer Stats — history logs hidden by the customer stay excluded.
    const myOrders = await ordersCollection
      .find({ customerId: req.user._id, hiddenForCustomer: { $ne: true } })
      .sort({ createdAt: -1 })
      .toArray();
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

// 7. Role-Specific History Log Deletion (single entry)
router.delete('/history/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid order id' });
    }

    const order = await ordersCollection.findOne({ _id: new ObjectId(id) });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const role = req.user.role;

    // Admins remove the log entirely.
    if (role === 'admin') {
      await ordersCollection.deleteOne({ _id: new ObjectId(id) });
      return res.json({ message: 'Order removed from history' });
    }

    // Vendors hide the log from their own history only.
    if (role === 'vendor') {
      await ordersCollection.updateOne({ _id: new ObjectId(id) }, { $set: { hiddenForVendor: true } });
      return res.json({ message: 'Order removed from your history' });
    }

    // Customers can only hide their own logs.
    if (String(order.customerId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to remove this order from history' });
    }

    await ordersCollection.updateOne({ _id: new ObjectId(id) }, { $set: { hiddenForCustomer: true } });
    res.json({ message: 'Order removed from your history' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete order history log', error: error.message });
  }
});

// 8. Role-Specific History Log Clearing (all entries for the current role)
router.delete('/history', verifyToken, async (req, res) => {
  try {
    const role = req.user.role;

    // Admins clear completed / cancelled logs permanently.
    if (role === 'admin') {
      const result = await ordersCollection.deleteMany({
        status: { $in: ['completed', 'delivered', 'cancelled'] },
      });
      return res.json({
        message: 'Completed and cancelled order logs cleared',
        deletedCount: result.deletedCount || 0,
      });
    }

    // Vendors hide every log on their kitchen's orders.
    if (role === 'vendor') {
      const result = await ordersCollection.updateMany(vendorOrdersQuery(req.user), {
        $set: { hiddenForVendor: true },
      });
      return res.json({
        message: 'Order history cleared',
        modifiedCount: result.modifiedCount || 0,
      });
    }

    // Customers hide every log of their own orders.
    const result = await ordersCollection.updateMany(
      { customerId: req.user._id },
      { $set: { hiddenForCustomer: true } }
    );
    res.json({ message: 'Order history cleared', modifiedCount: result.modifiedCount || 0 });
  } catch (error) {
    res.status(500).json({ message: 'Failed to clear order history', error: error.message });
  }
});

export default router;
