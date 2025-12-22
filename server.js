// server.js — FINAL WITH FULL M-PESA SUPPORT
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
  MPESA_SHORTCODE = '174379',  // default sandbox
  MPESA_PASSKEY = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',  // default sandbox
  MONGODB_URI
} = process.env;

/* ---------- ENV CHECK ---------- */
console.log('=== ENV CHECK ===');
console.log('PAYPAL_CLIENT_ID      :', !!PAYPAL_CLIENT_ID ? 'present' : 'MISSING');
console.log('PAYPAL_CLIENT_SECRET :', !!PAYPAL_CLIENT_SECRET ? 'present' : 'MISSING');
console.log('MONGODB_URI           :', !!MONGODB_URI ? 'present' : 'MISSING');
console.log('MPESA_SHORTCODE       :', MPESA_SHORTCODE || 'MISSING');
console.log('MPESA_PASSKEY         :', MPESA_PASSKEY ? 'present' : 'MISSING');
console.log('==================');

/* ---------- MONGO CONNECTION ---------- */
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
    await db.collection('connection_test').insertOne({ ts: new Date(), event: 'connect' });
    console.log('MongoDB write test passed');
    return db;
  } catch (err) {
    console.error('MongoDB connection FAILED:', err.message);
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
    "default-src 'self'; " +
    "script-src 'self' https://cdn.jsdelivr.net https://www.paypal.com https://www.sandbox.paypal.com 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "frame-src 'self' https://www.paypal.com https://www.sandbox.paypal.com; " +
    "connect-src 'self' https://ipapi.co https://v6.exchangerate-api.com https://www.paypal.com https://www.sandbox.paypal.com https://sandbox.safaricom.co.ke"
  );
  next();
});

/* ---------- LOAD PRODUCTS ---------- */
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
      images: p.images || [],
      image: p.images?.[0] ?? 'https://placehold.co/600x600?text=No+Image',
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

  res.render('product', { 
    product, 
    ratings,
    clientId: PAYPAL_CLIENT_ID
  });
});

app.get('/terms', (req, res) => res.render('terms'));
app.get('/track-order', (req, res) => res.render('track-order'));

app.get('/test-db', async (req, res) => {
  const db = await getDb();
  if (!db) return res.json({ connected: false, error: 'Failed to connect' });
  try {
    const cols = await db.listCollections().toArray();
    res.json({ connected: true, collections: cols.map(c => c.name) });
  } catch (e) {
    res.json({ connected: false, error: e.message });
  }
});

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

/* ---------- CREATE ORDER — FULL M-PESA SUPPORT */
app.post('/create-order', async (req, res) => {
  console.log('=== /create-order INVOKED ===');
  const db = await getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable.' });

  try {
    const { name, phone, address, paymentMethod, cart, totalUSD } = req.body;
    const orderId = uuidv4();

    // Calculate total in USD
    const totalInUSD = totalUSD || Object.values(cart).reduce((sum, item) => sum + item.price * item.quantity, 0);

    if (paymentMethod === 'mpesa') {
      if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET || !MPESA_SHORTCODE || !MPESA_PASSKEY) {
        return res.status(400).json({ error: 'M-Pesa configuration missing on server.' });
      }

      // Convert to KES (approximate rate, or use your exchange API)
      const totalInKES = Math.round(totalInUSD * 130); // 1 USD ≈ 130 KES (adjust if needed)

      if (totalInKES < 1) {
        return res.status(400).json({ error: 'Amount too low for M-Pesa transaction.' });
      }

      const token = await getMpesaAccessToken();
      const mpesaResponse = await initiateMpesaPayment(orderId, phone, totalInKES);

      if (mpesaResponse.ResponseCode === '0') {
        await db.collection('orders').insertOne({
          orderId,
          name,
          phone,
          address,
          cart,
          paymentMethod,
          status: 'Pending',
          createdAt: new Date().toISOString(),
          mpesaRequestId: mpesaResponse.CheckoutRequestID,
          amountKES: totalInKES
        });

        return res.json({ success: true, orderId });
      } else {
        console.error('M-Pesa initiation failed:', mpesaResponse);
        return res.status(400).json({ error: 'M-Pesa request failed', details: mpesaResponse.ResponseDescription || mpesaResponse });
      }
    }

    // COD or PayPal
    await db.collection('orders').insertOne({
      orderId,
      name,
      phone,
      address,
      cart,
      paymentMethod,
      status: 'Pending',
      createdAt: new Date().toISOString()
    });

    return res.json({ success: true, orderId });

  } catch (e) {
    console.error('create-order error:', e.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

app.get('/track-order/:id', async (req, res) => {
  const db = await getDb();
  if (!db) return res.status(503).json({ error: 'Database unavailable.' });
  const order = await db.collection('orders').findOne({ orderId: req.params.id });
  order ? res.json({ success: true, order }) : res.status(404).json({ error: 'Not found.' });
});

/* ---------- M-PESA HELPERS ---------- */
async function getMpesaAccessToken() {
  const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
  const { data } = await axios.get(
    'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    { headers: { Authorization: `Basic ${auth}` } }
  );
  return data.access_token;
}

async function initiateMpesaPayment(orderId, phone, amount) {
  const token = await getMpesaAccessToken();
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');

  const payload = {
    BusinessShortCode: MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: amount,
    PartyA: phone,
    PartyB: MPESA_SHORTCODE,
    PhoneNumber: phone,
    CallBackURL: 'https://braviem.com/mpesa-callback',  // Update when live
    AccountReference: 'braviem.com',
    TransactionDesc: 'Braviem car parts payment'
  };

  const { data } = await axios.post(
    'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    payload,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  return data;
}

/* ---------- M-PESA CALLBACK ---------- */
app.post('/mpesa-callback', async (req, res) => {
  try {
    const callbackData = req.body;
    console.log('M-Pesa Callback:', JSON.stringify(callbackData, null, 2));

    const { CheckoutRequestID, ResultCode } = callbackData.Body.stkCallback;

    const db = await getDb();
    if (db) {
      const order = await db.collection('orders').findOne({ mpesaRequestId: CheckoutRequestID });
      if (order) {
        const status = ResultCode === 0 ? 'Paid' : 'Failed';
        await db.collection('orders').updateOne(
          { mpesaRequestId: CheckoutRequestID },
          { $set: { status, mpesaCallback: callbackData, updatedAt: new Date().toISOString() } }
        );
      }
    }
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (e) {
    console.error('M-Pesa callback error:', e);
    res.status(500).send('Error');
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
    res.status(500).json({ error: 'Failed.' });
  }
});

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});