import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const port = process.env.PORT || 10000;

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.resolve('views'));

// Serve static files
app.use('/css', express.static(path.join('public', 'css')));
app.use('/js', express.static(path.join('public', 'js')));
app.use('/data', express.static(path.join('public', 'data')));

// Route to render the index page
app.get('/', (req, res) => {
  try {
    // Read products from JSON file
    const productsData = readFileSync(path.join('public', 'data', 'products.json'), 'utf8');
    const products = JSON.parse(productsData);
    res.render('index', { products, clientId: process.env.PAYPAL_CLIENT_ID });
  } catch (error) {
    console.error('Error reading products.json:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});