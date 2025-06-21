import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

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
    console.log('Attempting to read products.json');
    const productsData = readFileSync(path.join('public', 'data', 'products.json'), 'utf8');
    console.log('Raw products data:', productsData);
    const rawProducts = JSON.parse(productsData);
    console.log('Parsed raw products:', rawProducts);
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
    console.log('Rendered products:', products);
    res.render('index', { products, clientId: process.env.PAYPAL_CLIENT_ID });
  } catch (error) {
    console.error('Error processing products.json:', error);
    res.status(500).send('Internal Server Error: Unable to process product data');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});