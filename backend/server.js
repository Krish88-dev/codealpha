const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');
const db = require('./db');
let User, Product, Order;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'codealpha-secret-key';

io.on('connection', (socket) => {
  socket.emit('welcome', { message: 'Connected to CodeAlpha realtime server' });
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Authentication required', reauth: true });
  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ message: 'Session invalid — please log in again', reauth: true });
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token', reauth: true });
  }
};

app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Username, email, and password are required.' });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(409).json({ message: 'Email already in use.' });
  }

  const hashedPassword = bcrypt.hashSync(password, 8);
  const user = await User.create({ username, email, password: hashedPassword });
  const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: { id: user._id, username: user.username, email: user.email } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const user = await User.findOne({ email });
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: { id: user._id, username: user.username, email: user.email } });
});

app.get('/api/products', async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

app.get('/api/products/:id', async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found.' });
  res.json(product);
});

app.post('/api/orders', authMiddleware, async (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Cart items are required.' });
  }

  let total = 0;
  const orderItems = [];

  for (const item of items) {
    const product = await Product.findById(item.productId);
    if (!product) continue;
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const price = product.price * quantity;
    total += price;
    orderItems.push({ productId: product._id, quantity, unitPrice: product.price });
  }

  const order = await Order.create({ userId: req.user._id, items: orderItems, total });
  io.emit('orderPlaced', {
    orderId: order._id,
    total,
    items: orderItems,
    username: req.user.username
  });
  res.json({ message: 'Order created successfully', orderId: order._id, total, items: orderItems });
});

app.get('/api/orders', authMiddleware, async (req, res) => {
  const orders = await Order.find({ userId: req.user._id }).populate('items.productId');
  res.json(orders);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const seedProducts = async () => {
  const count = await Product.countDocuments();
  if (count > 0) return;

  await Product.insertMany([
    {
      name: 'Modern Backpack',
      description: 'Spacious, durable backpack for everyday carry.',
      price: 49.99,
      imageUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
      stock: 18
    },
    {
      name: 'Wireless Headphones',
      description: 'Noise-cancelling headphones with long battery life.',
      price: 89.99,
      imageUrl: 'https://images.unsplash.com/photo-1511376777868-611b54f68947?auto=format&fit=crop&w=600&q=80',
      stock: 12
    },
    {
      name: 'Smartwatch',
      description: 'Track your fitness and notifications on the go.',
      price: 129.99,
      imageUrl: 'https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?auto=format&fit=crop&w=600&q=80',
      stock: 9
    },
    {
      name: 'Classic Sneakers',
      description: 'Comfortable sneakers with modern street style.',
      price: 69.99,
      imageUrl: 'https://images.unsplash.com/photo-1519741493563-8c7e486c80d1?auto=format&fit=crop&w=600&q=80',
      stock: 25
    }
  ]);
};

const start = async () => {
  try {
    const models = await db.connectToDb();
    User = models.User;
    Product = models.Product;
    Order = models.Order;
    await seedProducts();
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
  }
};

start();
