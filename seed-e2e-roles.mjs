import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { MongoClient } from 'mongodb';

// Throwaway customer/vendor test accounts used to regression-check that the
// session/proxy fixes didn't break the roles that already worked.
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
const password = 'CustomerTest123';
const hash = await bcrypt.hash(password, 10);
const users = [
  { name: 'E2E Customer', email: 'customer-e2e-test@pizzahub.dev', role: 'customer', restaurantName: null, image: '/user.jpg' },
  { name: 'E2E Vendor', email: 'vendor-e2e-test@pizzahub.dev', role: 'vendor', restaurantName: 'E2E Pizzeria', image: '/vendor.jpg' },
];
try {
  await client.connect();
  const col = client.db('pizzaHubDB').collection('users');
  for (const u of users) {
    await col.updateOne(
      { email: u.email },
      { $set: { ...u, password: hash, isBlocked: false, createdAt: new Date() } },
      { upsert: true }
    );
    console.log('ready:', u.email, u.role);
  }
} catch (e) {
  console.error('ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
