import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'fs';

dotenv.config();

const app = express();
const port = process.env.PORT || 10000;

app.set('view engine', 'ejs');
app.set('views', path.resolve('views'));

app.use('/css', express.static(path.join('public', 'css')));
app.use('/js', express.static(path.join('public', 'js')));
app.use('/data', express.static(path.join('public', 'data')));

app.get('/', (req, res) => {
  try {
    const productsPath = path.join('public', 'data', 'products.json');
    if (!existsSync(productsPath)) {
      throw new Error('products.json file not found');
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log('Attempting to read products.json from:', productsPath);
    }
    const productsData = readFileSync(productsPath, 'utf8');
    if (!productsData) {
      throw new Error('products.json is empty');
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log('Raw products data:', productsData.slice(0, 100));
    }
    const rawProducts = JSON.parse(productsData);
    if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
      throw new Error('products.json contains no valid products');
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log('Parsed raw products:', rawProducts);
    }
    const products = rawProducts.map(product => {
      const price = parseFloat(product.price);
      if (isNaN(price)) {
        console.error(`Invalid price for product ${product.title} (id: ${product.id}):`, product.price);
        return null;
      }
      return {
        id: product.id,
        title: product.title,
        price: price,
        image: product.image
      };
    }).filter(product => product !== null);
    if (products.length === 0) {
      throw new Error('No valid products found after parsing');
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log('Rendered products:', products);
    }
    res.set('Content-Type', 'text/html');
    res.render('index', { products, clientId: process.env.PAYPAL_CLIENT_ID }, (err, html) => {
      if (err) {
        console.error('Error rendering EJS:', err);
        res.status(500).set('Content-Type', 'text/html').render('error', { message: 'Rendering error. Please try again.' });
        return;
      }
      if (process.env.NODE_ENV !== 'production') {
        console.log('Rendered HTML starts with:', html.slice(0, 50));
      }
      res.send(html);
    });
  } catch (error) {
    console.error('Error processing request:', error.message);
    res.status(500).set('Content-Type', 'text/html').render('error', { message: `Unable to load products: ${error.message}` });
  }
});

// Export the app for Vercel
export default app;

// Start the server for local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}