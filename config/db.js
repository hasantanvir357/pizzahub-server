import { MongoClient, ServerApiVersion } from 'mongodb';
import 'dotenv/config';

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;
export let usersCollection;
export let menuItemsCollection;
export let ordersCollection;
export let transactionsCollection;

export async function connectDB() {
  try {
    if (!db) {
      await client.connect();
      db = client.db('pizzaHubDB');

      usersCollection = db.collection('users');
      menuItemsCollection = db.collection('menuItems');
      ordersCollection = db.collection('orders');
      transactionsCollection = db.collection('transactions');

      console.log('Successfully connected to MongoDB (pizzaHubDB)!');
    }
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}
