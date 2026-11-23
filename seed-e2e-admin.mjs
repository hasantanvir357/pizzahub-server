import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { MongoClient } from 'mongodb';

// Creates (or resets) a throwaway admin test account whose avatar is a large
// base64 data URI — exactly like the seeded admin@gmail.com account — so we can
// reproduce the admin bug without touching the real seeded account.
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
const email = 'admin-e2e-test@pizzahub.dev';
const password = 'AdminTest123';

try {
  await client.connect();
  const db = client.db('pizzaHubDB');
  const users = db.collection('users');
  const hash = await bcrypt.hash(password, 10);

  // ~9.4KB base64 avatar, same size class as the seeded admin's image.
  const bigImage = 'data:image/jpeg;base64,' + 'A'.repeat(9395);

  await users.updateOne(
    { email },
    {
      $set: {
        name: 'E2E Admin',
        email,
        password: hash,
        role: 'admin',
        restaurantName: null,
        image: bigImage,
        isBlocked: false,
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
  const doc = await users.findOne({ email });
  console.log('test admin ready:', doc._id.toString(), 'image len', doc.image.length, 'role', doc.role);
} catch (e) {
  console.error('ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
