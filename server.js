import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();
const envClientId = process.env.PAYPAL_CLIENT_ID; // Capture early
console.log('dotenv config loaded. PAYPAL_CLIENT_ID:', envClientId); // Debug log
if (!envClientId) {
    console.warn('PAYPAL_CLIENT_ID not found in environment. Falling back to YOUR_CLIENT_ID');
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
            title: product.title || 'Unnamed Product', // Preserve title for cart
            name: product.title || 'Unnamed Product', // Use title for EJS name field
            price: parseFloat(product.price) || 0,
            image: product.images && product.images.length > 0 ? product.images[0] : 'https://via.placeholder.com/150',
            additionalImages: product.images && product.images.length > 1 ? product.images.slice(1) : []
        }));
        console.log('Products loaded successfully:', products.length, 'items. First few IDs:', products.slice(0, 5).map(p => p.id)); // Debug log
    } catch (error) {
        console.error('Error loading or parsing products.json:', error.message);
        products = []; // Fallback to empty array
    }
} else {
    console.warn('products.json not found at:', productsPath, 'using empty product list');
    products = [];
}

// Route to render the main page
app.get('/', (req, res) => {
    try {
        if (products.length === 0) {
            console.warn('No products available, rendering with empty list');
        }
        const clientId = envClientId || 'YOUR_CLIENT_ID'; // Use the captured value
        console.log('Rendering with clientId:', clientId, 'and', products.length, 'products'); // Debug log
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private'); // Prevent caching
        res.render('index', {
            products: products,
            clientId: clientId
        }, (err, html) => {
            if (err) {
                console.error('EJS rendering error:', err.message);
                res.status(500).send('Internal Server Error - Rendering failed. Check server logs.');
                return;
            }
            res.send(html);
        });
    } catch (error) {
        console.error('Server error in route:', error.stack);
        res.status(500).send('Internal Server Error - An unexpected error occurred. Check server logs.');
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Global server error:', err.stack);
    res.status(500).send('Internal Server Error - An unexpected error occurred. Check server logs.');
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});