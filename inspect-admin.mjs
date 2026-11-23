import 'dotenv/config';
import { MongoClient } from 'mongodb';
import jwt from 'jsonwebtoken';

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
try {
  await client.connect();
  const db = client.db('pizzaHubDB');
  const admin = await db.collection('users').findOne({ email: 'admin@gmail.com' });
  const { password, image, ...rest } = admin || {};
  console.log('admin fields:', Object.keys(admin || {}).join(', '));
  console.log('role:', JSON.stringify(admin?.role));
  console.log('image length:', image ? image.length : 0);
  console.log('password present:', !!password, password ? String(password).slice(0, 20) : '');
  console.log('other fields:', JSON.stringify(rest).slice(0, 400));

  const userPayload = {
    _id: admin._id.toString(),
    name: admin.name,
    email: admin.email,
    role: admin.role,
    restaurantName: admin.restaurantName || null,
    image: admin.image || '',
  };
  const token = jwt.sign(userPayload, process.env.JWT_SECRET, { expiresIn: '30d' });
  console.log('JWT length:', token.length);
  console.log('cookie string length:', `pizzahub_token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`.length);

  for (const email of ['user@gmail.com', 'vendor@gmail.com']) {
    const u = await db.collection('users').findOne({ email });
    const p = {
      _id: u._id.toString(), name: u.name, email: u.email, role: u.role,
      restaurantName: u.restaurantName || null, image: u.image || '',
    };
    const t = jwt.sign(p, process.env.JWT_SECRET, { expiresIn: '30d' });
    console.log(email, 'image len', (u.image || '').length, 'JWT len', t.length);
  }
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await client.close();
}
