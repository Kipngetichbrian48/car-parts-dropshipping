// server.js
import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { MongoClient } from 'mongodb';

dotenv.config();

const {
  PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET,
  EXCHANGE_RATE_API_KEY,
  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_SHORTCODE,
  MPESA_PASSKEY,
  MONGODB_URI
} = process.env;

/* ---------- ENV CHECK ---------- */
console.log('=== ENV CHECK ===');
console.log('PAYPAL_CLIENT_ID      :', !!PAYPAL_CLIENT_ID ? 'present' : 'MISSING');
console.log('PAYPAL_CLIENT_SECRET :', !!PAYPAL_CLIENT_SECRET ? 'present' : 'MISSING');
console.log('MONGODB_URI           :', !!MONGODB_URI ? 'present' : 'MISSING');
console.log('==================');

/* ---------- MONGO CONNECTION (PER REQUEST - NO GLOBAL DB) ---------- */
async function getDb() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI missing!');
    return null;
  }

  const client = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    maxPoolSize: 10,
    retryWrites: true,
    w: 'majority',
    tls: true,
    tlsAllowInvalidCertificates: false
  });

  try {
    console.log('Connecting to MongoDB Atlas...');
    await client.connect();
    console.log('MongoDB connected successfully');
    const db = client.db('braviem');

    // Test write
    await db.collection('connection_test').insertOne({ ts: new Date(), event: 'connect' });
    console.log('MongoDB write test passed');
    return db;
  } catch (err) {
    console.error('MongoDB connection FAILED:');
    console.error('Name:', err.name);
    console.error('Code:', err.code);
    console.error('Message:', err.message);
    console.error('URI preview:', MONGODB_URI.substring(0, 40) + '...');
    return null;
  }
}

/* ---------- EXPRESS SETUP ---------- */
const app = express();
const __dirname = dirname(fileURLToPath(import.meta.url));

app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));
app.use(express.static(join(__dirname, 'public')));
app.use(express.json());

/* ---------- CSP ---------- */
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net https://www.sandbox.paypal.com https://www.paypal.com 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https://via.placeholder.com https://*.aliexpress-media.com data: https://www.paypalobjects.com; frame-src 'self' https://www.sandbox.paypal.com; connect-src 'self' https://ipapi.co https://v6.exchangerate-api.com https://www.sandbox.paypal.com https://www.paypal.com"
  );
  next();
});

/* ---------- LOAD PRODUCTS FROM JSON (TEMP) ---------- */
const productsPath = join(__dirname, 'public', 'data', 'products.json');
let products = [];
if (existsSync(productsPath)) {
  try {
    const data = readFileSync(productsPath, 'utf8');
    products = JSON.parse(data).map(p => ({
      id: p.id || `temp-${Math.random().toString(36).substr(2, 9)}`,
      title: p.title || 'Unnamed Product',
      name: p.title || 'Unnamed Product',
      price: parseFloat(p.price) || 0,
      image: p.images?.[0] ?? 'https://via.placeholder.com/150',
      additionalImages: p.images?.slice(1) ?? [],
      sku: p.sku || '',
      category: p.category || 'Uncategorized'
    }));
    console.log('Products loaded from JSON:', products.length);
  } catch (e) {
    console.error('products.json error:', e.message);
  }
}

/* ---------- ROUTES ---------- */
app.get('/', (req, res) => {
  const cats = [...new Set(products.map(p => p.category))].sort();
  res.render('index', { products, clientId: PAYPAL_CLIENT_ID || 'YOUR_CLIENT_ID', categories: cats });
});

app.get('/product/:id', async (req, res) => {
  const product = products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).render('error', { message: 'Product not found.' });

  let ratings = [];
  const db = await getDb();
  if (db) {
    ratings = await db.collection('ratings').find({ productId: req.params.id }).toArray();
  }
  res.render('product', { product, ratings });
});

app.get('/terms', (req, res) => res.render('terms'));
app.get('/track-order', (req, res) => res.render('track-order'));

/* ---------- TEST DB ---------- */
app.get('/test-db', async (req, res) => {
  console.log('=== /test-db called ===');
  const db = await getDb();
  if (!db) {
    return res.json({ connected: false, error: 'Failed to connect' });
  }
  try {
    const cols = await db.listCollections().toArray();
    res.json({ connected: true, collections: cols.map(c => c.name) });
  } catch (e) {
    res.json({ connected: false, error: e.message });
  }
});

/* ---------- SUBMIT RATING ---------- */
app.post('/submit-rating', async (req, res) => {
  const db = await getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable.' });
  const { productId, rating, comment } = req.body;
  if (!productId || !rating) return res.status(400).json({ error: 'Missing fields.' });
  await db.collection('ratings').insertOne({
    productId, rating: parseInt(rating), comment: comment || '', timestamp: new Date().toISOString()
  });
  res.json({ success: true });
});

/* ---------- CREATE ORDER (FIXED - NO GLOBAL DB) ---------- */
app.post('/create-order', async (req, res) => {
  console.log('=== /create-order INVOKED ===');
  console.log(' оплатMethod:', req.body.paymentMethod);
  console.log('Cart items:', req.body.cart ? Object.keys(req.body.cart).length : 0);

  const db = await getDb();
  if (!db) {
    console.warn('Database connection failed — returning 503');
    return res.status(503).json({ error: 'Database unavailable. Please try again later.' });
  }

  try {
    const { name, phone, address, paymentMethod, cart } = req.body;
    const orderId = uuidv4();
    const total = Object.values(cart).reduce((s, i) => s + i.price * i.quantity, 0);

    if (paymentMethod === 'mpesa') {
      // M-Pesa logic (unchanged)
      if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET || !MPESA_SHORTCODE || !MPESA_PASSKEY) {
        return res.status(400).json({ error: 'M-Pesa config missing.' });
      }
      const token = await getMpesaAccessToken();
      const mpesa = await initiateMpesaPayment(orderId, phone, total);
      if (mpesa.ResponseCode === '0') {
        await db.collection('orders').insertOne({
          orderId, name, phone, address, cart, paymentMethod,
          status: 'Pending', createdAt: new Date().toISOString(),
          mpesaRequestId: mpesa.CheckoutRequestID
        });
        return res.json({ success: true, orderId, message: 'M-Pesa initiated.' });
      }
      return res.status(400).json({ error: 'M-Pesa failed.' });
    }

    if (paymentMethod === 'cod' || paymentMethod === 'paypal') {
      await db.collection('orders').insertOne({
        orderId, name, phone, address, cart, paymentMethod,
        status: 'Pending', createdAt: new Date().toISOString()
      });
      console.log('Order saved:', orderId);
      return res.json({
        success: true, orderId,
        message: `Order placed with ${paymentMethod === 'paypal' ? 'PayPal' : 'COD'}.`
      });
    }

    res.status(400).json({ error: 'Invalid payment method.' });
  } catch (e) {
    console.error('create-order error:', e.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

/* ---------- TRACK ORDER ---------- */
app.get('/track-order/:id', async (req, res) => {
  const db = await getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable.' });
  const orderId = req.params.id;
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(orderId)) return res.status(400).json({ error: 'Invalid ID.' });
  const order = await db.collection('orders').findOne({ orderId });
  order ? res.json({ success: true, order }) : res.status(404).json({ error: 'Not found.' });
});

/* ---------- M-PESA HELPERS ---------- */
async function getMpesaAccessToken() {
  const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
  const { data } = await axios.get(
    'https://sandbox.api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    { headers: { Authorization: `Basic ${auth}` } }
  );
  return data.access_token;
}

async function initiateMpesaPayment(orderId, phone, amount) {
  const token = await getMpesaAccessToken();
  const ts = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const pwd = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${ts}`).toString('base64');
  const { data } = await axios.post(
    'https://sandbox.api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: pwd,
      Timestamp: ts,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: phone,
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: 'https://braviem.vercel.app/mpesa-callback',
      AccountReference: orderId,
      TransactionDesc: 'Payment for car parts'
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}

/* ---------- M-PESA CALLBACK & EXCHANGE RATE ---------- */
app.post('/mpesa-callback', async (req, res) => {
  try {
    const { CheckoutRequestID, ResultCode } = req.body.Body.stkCallback;
    const db = await getDb();
    if (db) {
      const order = await db.collection('orders').findOne({ mpesaRequestId: CheckoutRequestID });
      if (order) {
        const status = ResultCode === '0' ? 'Confirmed' : 'Failed';
        await db.collection('orders').updateOne(
          { mpesaRequestId: CheckoutRequestID },
          { $set: { status, updatedAt: new Date().toISOString() } }
        );
      }
    }
    res.json({ success: true });
  } catch (e) {
    console.error('mpesa-callback error:', e);
    res.status(500).json({ error: 'Failed.' });
  }
});

app.get('/api/exchange-rate', async (req, res) => {
  try {
    const currency = req.query.currency || 'USD';
    if (currency === 'USD') return res.json({ rate: 1 });
    if (!EXCHANGE_RATE_API_KEY) return res.status(500).json({ error: 'API key missing.' });
    const { data } = await axios.get(`https://v6.exchangerate-api.com/v6/${EXCHANGE_RATE_API_KEY}/latest/USD`);
    res.json({ rate: data.conversion_rates[currency] ?? 1 });
  } catch (e) {
    console.error('exchange-rate error:', e.message);
    res.status(500).json({ error: 'Failed.' });
  }
});

/* ---------- START SERVER ---------- */
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});