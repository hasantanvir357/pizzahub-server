import { MongoClient } from 'mongodb';

const uri = 'mongodb://pizzaHubDB:pizzaHubDB@ac-mfvszvj-shard-00-00.v0eljkb.mongodb.net:27017,ac-mfvszvj-shard-00-01.v0eljkb.mongodb.net:27017,ac-mfvszvj-shard-00-02.v0eljkb.mongodb.net:27017/?ssl=true&replicaSet=atlas-w851o8-shard-0&authSource=admin';

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
try {
  await client.connect();
  const db = client.db('pizzaHubDB');
  const collections = await db.listCollections().toArray();
  console.log('collections:', collections.map((c) => c.name).join(', '));
  const users = db.collection('users');
  const all = await users.find({}).project({ password: 0 }).toArray();
  console.log('user count:', all.length);
  for (const u of all) {
    console.log(JSON.stringify(u));
  }
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await client.close();
}
