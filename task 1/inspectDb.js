const mongoose = require('mongoose');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/codealpha_store';

(async () => {
  try {
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('Connected to', MONGODB_URI);
    console.log('Collections:', collections.map(c => c.name));
    for (const coll of collections) {
      const docs = await db.collection(coll.name).find().limit(10).toArray();
      console.log('\nCollection:', coll.name);
      console.dir(docs, { depth: 3, colors: false });
    }
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
