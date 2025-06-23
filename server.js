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
    const productsPath = path.resolve('public', 'data', 'products.json');
    console.log(`Attempting to access products.json at: ${productsPath}`);
    if (!existsSync(productsPath)) {
      throw new Error('products.json file not found');
    }
    const productsData = readFileSync(productsPath, 'utf8');
    if (!productsData) {
      throw new Error('products.json is empty');
    }
    console.log('products.json read successfully, first 100 chars:', productsData.slice(0, 100));
    const rawProducts = JSON.parse(productsData);
    if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
      throw new Error('products.json contains no valid products');
    }
    console.log('Parsed products count:', rawProducts.length);
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
    console.log('Valid products count:', products.length);
    res.set('Content-Type', 'text/html');
    res.render('index', { products, clientId: process.env.PAYPAL_CLIENT_ID }, (err, html) => {
      if (err) {
        console.error('Error rendering index.ejs:', err);
        res.status(500).set('Content-Type', 'text/html').render('error', { message: 'Rendering error. Please try again.' });
        return;
      }
      console.log('Rendered HTML starts with:', html.slice(0, 50));
      res.send(html);
    });
  } catch (error) {
    console.error('Error processing request:', error.message, error.stack);
    res.status(500).set('Content-Type', 'text/html').render('error', { message: `Unable to load products: ${error.message}` });
  }
});

// Export for Vercel
export default app;

// Start server for local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}