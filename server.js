import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();
const envClientId = process.env.PAYPAL_CLIENT_ID;
console.log('dotenv config loaded. PAYPAL_CLIENT_ID:', envClientId ? 'Set' : 'Not set');
if (!envClientId) {
    console.warn('PAYPAL_CLIENT_ID not found in environment.');
}

const app = express();
const port = 10000;
const __dirname = dirname(fileURLToPath(import.meta.url));

// Middleware to serve static files
app.use(express.static(join(__dirname, 'public')));

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));

// Load products from JSON file
const productsPath = join(__dirname, 'public', 'data', 'products.json');
let products = [];
if (existsSync(productsPath)) {
    try {
        const productsData = readFileSync(productsPath, 'utf8');
        const rawProducts = JSON.parse(productsData);
        products = rawProducts.map(product => ({
            id: product.id,
            title: product.title || 'Unnamed Product',
            name: product.title || 'Unnamed Product',
            price: parseFloat(product.price) || 0,
            image: product.images && product.images.length > 0 ? product.images[0] : 'https://via.placeholder.com/150',
            additionalImages: product.images && product.images.length > 1 ? product.images.slice(1) : [],
            sku: product.sku || '',
            category: product.category || 'Uncategorized'
        }));
        const uniqueCategories = [...new Set(products.map(p => p.category))];
        console.log('Products loaded successfully:', products.length, 'items.');
        console.log('Categories found:', uniqueCategories);
        console.log('Sample product:', products[0]); // Debug: Log first product
    } catch (error) {
        console.error('Error loading or parsing products.json:', error.message);
        products = [];
    }
} else {
    console.warn('products.json not found at:', productsPath, 'using empty product list');
    products = [];
}

// Debug endpoint to check products
app.get('/debug/products', (req, res) => {
    res.json(products);
});

// Route to render the main page
app.get('/', (req, res) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.render('index', {
            products: products,
            clientId: envClientId || 'YOUR_CLIENT_ID'
        });
    } catch (error) {
        console.error('Server error in route:', error.stack);
        res.status(500).render('error', { message: 'Internal Server Error - An unexpected error occurred.' });
    }
});

// Route for product details
app.get('/product/:id', (req, res) => {
    const product = products.find(p => p.id === req.params.id);
    if (!product) {
        return res.status(404).render('error', { message: 'Product not found' });
    }
    res.render('product', { product, clientId: envClientId || 'YOUR_CLIENT_ID' });
});

// Route for terms and conditions
app.get('/terms', (req, res) => {
    res.render('terms');
});

// Route for license
app.get('/license', (req, res) => {
    res.render('license');
});

// Route for sitemap
app.get('/sitemap.xml', (req, res) => {
    res.set('Content-Type', 'application/xml');
    res.render('sitemap', { products });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Global server error:', err.stack);
    res.status(500).render('error', { message: 'Internal Server Error - An unexpected error occurred.' });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});