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
  PAYPAL_CLIENT_SECRET,          // <-- added for PayPal
  EXCHANGE_RATE_API_KEY,
  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_SHORTCODE,
  MPESA_PASSKEY,
  MONGODB_URI
} = process.env;

/* ---------- STARTUP DIAGNOSTICS ---------- */
console.log('=== ENV CHECK ===');
console.log('PAYPAL_CLIENT_ID      :', !!PAYPAL_CLIENT_ID ? 'present' : 'MISSING');
console.log('PAYPAL_CLIENT_SECRET :', !!PAYPAL_CLIENT_SECRET ? 'present' : 'MISSING');
console.log('MONGODB_URI           :', !!MONGODB_URI ? 'present' : 'MISSING');
console.log('==================');

if (!PAYPAL_CLIENT_ID) console.warn('PAYPAL_CLIENT_ID not found in environment.');
if (!PAYPAL_CLIENT_SECRET) console.warn('PAYPAL_CLIENT_SECRET not found in environment.');
if (!EXCHANGE_RATE_API_KEY) console.warn('EXCHANGE_RATE_API_KEY not found in environment.');
if (!MONGODB_URI) console.warn('MONGODB_URI not found in environment. Orders and ratings will be disabled.');
/* ---------- END STARTUP DIAGNOSTICS ---------- */

const app = express();
const port = 10000;
const __dirname = dirname(fileURLToPath(import.meta.url));

// MongoDB setup
let db = null;
async function connectToMongoDB() {
  let retries = 5;
  while (retries > 0) {
    try {
      const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
      await client.connect();
      console.log('Connected to MongoDB');
      db = client.db('braviem');
      return;
    } catch (error) {
      console.error(`MongoDB connection failed (attempt ${6 - retries}/5):`, error.message);
      retries--;
      if (retries === 0) {
        console.warn('MongoDB connection failed after 5 attempts. Continuing without MongoDB.');
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}
connectToMongoDB();

app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));
app.use(express.static(join(__dirname, 'public')));
app.use(express.json());

// Content Security Policy
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net https://www.sandbox.paypal.com https://www.paypal.com 'unsafe-inline'; style-src 'self'; img-src 'self' https://via.placeholder.com https://*.aliexpress-media.com data:; connect-src 'self' https://ipapi.co https://v6.exchangerate-api.com https://www.sandbox.paypal.com https://www.paypal.com"
  );
  next();
});

// Load products from JSON file
const productsPath = join(__dirname, 'public', 'data', 'products.json');
let products = [];
if (existsSync(productsPath)) {
  try {
    const productsData = readFileSync(productsPath, 'utf8');
    products = JSON.parse(productsData).map(product => ({
      id: product.id || `temp-id-${Math.random().toString(36).substr(2, 9)}`,
      title: product.title || 'Unnamed Product',
      name: product.title || 'Unnamed Product',
      price: parseFloat(product.price) || 0,
      image: product.images?.length > 0 ? product.images[0] : 'https://via.placeholder.com/150',
      additionalImages: product.images?.length > 1 ? product.images.slice(1) : [],
      sku: product.sku || '',
      category: product.category || 'Uncategorized'
    }));
    console.log('Products loaded:', products.length, 'items.');
  } catch (error) {
    console.error('Error loading products.json:', error.message);
    products = [];
  }
}

// Routes
app.get('/', (req, res) => {
  try {
    const uniqueCategories = [...new Set(products.map(p => p.category))].sort();
    res.render('index', {
      products,
      clientId: PAYPAL_CLIENT_ID || 'YOUR_CLIENT_ID',
      categories: uniqueCategories
    });
  } catch (error) {
    console.error('Server error in route:', error.stack);
    res.status(500).render('error', { message: 'Internal Server Error.' });
  }
});

app.get('/product/:id', async (req, res) => {
  try {
    const product = products.find(p => p.id === req.params.id);
    if (!product) {
      return res.status(404).render('error', { message: 'Product not found.' });
    }
    const productRatings = db ? await db.collection('ratings').find({ productId: req.params.id }).toArray() : [];
    res.render('product', { product, ratings: productRatings });
  } catch (error) {
    console.error('Error in product route:', error.stack);
    res.status(500).render('error', { message: 'Internal Server Error.' });
  }
});

app.get('/terms', (req, res) => {
  try {
    res.render('terms');
  } catch (error) {
    console.error('Error in terms route:', error.stack);
    res.status(500).render('error', { message: 'Internal Server Error.' });
  }
});

app.get('/track-order', (req, res) => {
  try {
    res.render('track-order');
  } catch (error) {
    console.error('Error in track-order route:', error.stack);
    res.status(500).render('error', { message: 'Internal Server Error.' });
  }
});

app.post('/submit-rating', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database unavailable.' });
  try {
    const { productId, rating, comment } = req.body;
    if (!productId || !rating) {
      return res.status(400).json({ error: 'Product ID and rating are required.' });
    }
    await db.collection('ratings').insertOne({
      productId,
      rating: parseInt(rating),
      comment: comment || '',
      timestamp: new Date().toISOString()
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error submitting rating:', error);
    res.status(500).json({ error: 'Internal Server Error.' });
  }
});

/* ---------- /create-order WITH DIAGNOSTIC LOGGING ---------- */
app.post('/create-order', async (req, res) => {
  console.log('=== /create-order INVOKED ===');
  console.log('paymentMethod :', req.body.paymentMethod);
  console.log('cart items    :', req.body.cart ? Object.keys(req.body.cart).length : 0);
  console.log('db available  :', !!db);
  console.log('PAYPAL_CLIENT_ID      :', !!PAYPAL_CLIENT_ID ? 'present' : 'MISSING');
  console.log('PAYPAL_CLIENT_SECRET :', !!PAYPAL_CLIENT_SECRET ? 'present' : 'MISSING');
  console.log('MONGODB_URI           :', !!MONGODB_URI ? 'present' : 'MISSING');

  if (!db) {
    console.warn('Database not connected – returning 503');
    return res.status(503).json({ error: 'Database unavailable.' });
  }

  try {
    const { name, phone, address, paymentMethod, cart } = req.body;
    const orderId = uuidv4();
    const orderTotal = Object.values(cart).reduce((sum, item) => sum + item.price * item.quantity, 0);

    if (paymentMethod === 'mpesa') {
      if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET || !MPESA_SHORTCODE || !MPESA_PASSKEY) {
        console.warn('M-Pesa config incomplete');
        return res.status(400).json({ error: 'M-Pesa configuration is incomplete.' });
      }
      const accessToken = await getMpesaAccessToken();
      const mpesaResponse = await initiateMpesaPayment(orderId, phone, orderTotal);
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
          mpesaRequestId: mpesaResponse.CheckoutRequestID
        });
        console.log('M-Pesa order created – orderId:', orderId);
        res.json({ success: true, orderId, message: 'M-Pesa payment initiated. Please complete the payment on your phone.' });
      } else {
        console.warn('M-Pesa initiation failed:', mpesaResponse);
        res.status(400).json({ error: 'M-Pesa payment initiation failed.' });
      }
    } else if (paymentMethod === 'cod' || paymentMethod === 'paypal') {
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
      console.log(`${paymentMethod.toUpperCase()} order created – orderId:`, orderId);
      res.json({ success: true, orderId, message: `Order placed successfully with ${paymentMethod === 'paypal' ? 'PayPal' : 'Cash on Delivery'}.` });
    } else {
      console.warn('Invalid paymentMethod:', paymentMethod);
      res.status(400).json({ error: 'Invalid payment method.' });
    }
  } catch (error) {
    console.error('=== /create-order ERROR ===');
    console.error('Message :', error.message);
    console.error('Stack   :', error.stack);
    console.error('============================');
    res.status(500).json({ error: 'Internal Server Error.' });
  }
});
/* ---------- END /create-order LOGGING ---------- */

app.get('/track-order/:id', async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database unavailable.' });
  try {
    const orderId = req.params.id;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orderId)) {
      return res.status(400).json({ error: 'Invalid Order ID format.' });
    }
    const order = await db.collection('orders').findOne({ orderId });
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    res.json({ success: true, order });
  } catch (error) {
    console.error('Error tracking order:', error);
    res.status(500).json({ error: 'Internal Server Error.' });
  }
});

// M-Pesa Access Token
async function getMpesaAccessToken() {
  const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
  const response = await axios.get('https://sandbox.api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
    headers: { Authorization: `Basic ${auth}` }
  });
  return response.data.access_token;
}

// Initiate M-Pesa Payment
async function initiateMpesaPayment(orderId, phone, amount) {
  const accessToken = await getMpesaAccessToken();
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');
  const response = await axios.post(
    'https://sandbox.api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: phone,
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: 'https://braviem.vercel.app/mpesa-callback',
      AccountReference: orderId,
      TransactionDesc: 'Payment for car parts'
    },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return response.data;
}

// M-Pesa Callback
app.post('/mpesa-callback', async (req, res) => {
  try {
    const { CheckoutRequestID, ResultCode, ResultDesc } = req.body.Body.stkCallback;
    if (db) {
      const order = await db.collection('orders').findOne({ mpesaRequestId: CheckoutRequestID });
      if (order) {
        const newStatus = ResultCode === '0' ? 'Confirmed' : 'Failed';
        await db.collection('orders').updateOne(
          { mpesaRequestId: CheckoutRequestID },
          { $set: { status: newStatus, updatedAt: new Date().toISOString() } }
        );
        console.log(`M-Pesa callback: Order ${order.orderId} status updated to ${newStatus}`);
      }
    }
    res.json({ success: true });
  } catch (error) {
    console.error('M-Pesa callback error:', error);
    res.status(500).json({ error: 'Callback processing failed.' });
  }
});

// Exchange Rate Endpoint
app.get('/api/exchange-rate', async (req, res) => {
  try {
    const currency = req.query.currency || 'USD';
    if (currency === 'USD') {
      return res.json({ rate: 1 });
    }
    if (!EXCHANGE_RATE_API_KEY) {
      return res.status(500).json({ error: 'Exchange rate API key missing.' });
    }
    const response = await axios.get(`https://v6.exchangerate-api.com/v6/${EXCHANGE_RATE_API_KEY}/latest/USD`);
    const rate = response.data.conversion_rates[currency] || 1;
    res.json({ rate });
  } catch (error) {
    console.error('Error fetching exchange rate:', error.message);
    res.status(500).json({ error: 'Failed to fetch exchange rate.' });
  }
});

app.listen(port, (err) => {
  if (err) {
    console.error('Server failed to start:', err.message);
    process.exit(1);
  }
  console.log(`Server running at http://localhost:${port}`);
});