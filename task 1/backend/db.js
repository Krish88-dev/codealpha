const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/codealpha_store';

let usingMemoryDb = false;

const createInMemoryStore = () => {
  const Users = [];
  const Products = [];
  const Orders = [];

  const genId = () => (Date.now().toString(36) + Math.random().toString(36).slice(2, 9));

  const UserModel = {
    findById: async (id) => Users.find(u => String(u._id) === String(id)) || null,
    findOne: async (filter) => Users.find(u => Object.keys(filter).every(k => u[k] === filter[k])) || null,
    create: async (obj) => {
      const u = { ...obj, _id: genId(), createdAt: new Date(), updatedAt: new Date() };
      Users.push(u);
      return u;
    }
  };

  const ProductModel = {
    find: async () => Products.slice(),
    findById: async (id) => Products.find(p => String(p._id) === String(id)) || null,
    countDocuments: async () => Products.length,
    insertMany: async (arr) => {
      const items = arr.map(p => ({ ...p, _id: genId(), createdAt: new Date(), updatedAt: new Date() }));
      Products.push(...items);
      return items;
    }
  };

  const OrderModel = {
    create: async (obj) => {
      const o = { ...obj, _id: genId(), createdAt: new Date(), updatedAt: new Date() };
      Orders.push(o);
      return o;
    },
    find: (filter = {}) => {
      const results = Orders.filter(o => {
        if (filter.userId) return String(o.userId) === String(filter.userId);
        return true;
      });
      return {
        populate: async (path) => {
          // only support items.productId
          const populated = results.map(o => {
            const items = (o.items || []).map(it => {
              const prod = Products.find(p => String(p._id) === String(it.productId));
              return { ...it, productId: prod || it.productId };
            });
            return { ...o, items };
          });
          return populated;
        }
      };
    }
  };

  return { User: UserModel, Product: ProductModel, Order: OrderModel };
};

const connectToDb = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });
    console.log(`Connected to MongoDB at ${MONGODB_URI}`);
    const userSchema = new mongoose.Schema({
      username: { type: String, required: true },
      email: { type: String, required: true, unique: true },
      password: { type: String, required: true }
    }, { timestamps: true });

    const productSchema = new mongoose.Schema({
      name: { type: String, required: true },
      description: { type: String, required: true },
      price: { type: Number, required: true, default: 0 },
      imageUrl: { type: String, required: true },
      stock: { type: Number, required: true, default: 0 }
    }, { timestamps: true });

    const orderItemSchema = new mongoose.Schema({
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: { type: Number, required: true, default: 1 },
      unitPrice: { type: Number, required: true, default: 0 }
    });

    const orderSchema = new mongoose.Schema({
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      items: [orderItemSchema],
      total: { type: Number, required: true, default: 0 }
    }, { timestamps: true });

    const User = mongoose.model('User', userSchema);
    const Product = mongoose.model('Product', productSchema);
    const Order = mongoose.model('Order', orderSchema);

    return { User, Product, Order };
  } catch (err) {
    console.warn('Could not connect to MongoDB, falling back to in-memory DB. Error:', err.message);
    usingMemoryDb = true;
    return createInMemoryStore();
  }
};

module.exports = { connectToDb };
