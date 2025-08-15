import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();
const envClientId = process.env.PAYPAL_CLIENT_ID;
console.log('PAYPAL_CLIENT_ID:', envClientId);
if (!envClientId) {
    console.warn('PAYPAL_CLIENT_ID not found in environment.');
}

const app = express();
const port = 10000;
const __dirname = dirname(fileURLToPath(import.meta.url));

app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));

app.use(express.static(join(__dirname, 'public')));

// Basic URL format validation
const isValidUrl = (url) => {
    try {
        new URL(url);
        return url.match(/\.(jpg|jpeg|png|avif|webp)$/i);
    } catch {
        return false;
    }
};

// Load products from JSON file
const productsPath = join(__dirname, 'public', 'data', 'products.json');
let products = [];
if (existsSync(productsPath)) {
    try {
        const productsData = readFileSync(productsPath, 'utf8');
        const rawProducts = JSON.parse(productsData);
        products = rawProducts.map(product => {
            const validImages = Array.isArray(product.images)
                ? product.images.filter(img => isValidUrl(img))
                : [];
            if (validImages.length < product.images?.length) {
                console.warn(`Invalid image URLs for product ${product.id || 'unknown'}:`, product.images);
            }
            return {
                id: product.id || `temp-id-${Math.random().toString(36).substr(2, 9)}`,
                title: product.title || 'Unnamed Product',
                name: product.title || 'Unnamed Product',
                price: parseFloat(product.price) || 0,
                image: validImages.length > 0 ? validImages[0] : 'https://via.placeholder.com/150',
                additionalImages: validImages.length > 1 ? validImages.slice(1) : [],
                sku: product.sku || '',
                category: product.category || 'Uncategorized'
            };
        });
        const uniqueCategories = [...new Set(products.map(p => p.category))];
        console.log('Products loaded successfully:', products.length, 'items.');
        console.log('Categories found:', uniqueCategories);
        console.log('Sample product:', products[0]);
    } catch (error) {
        console.error('Error loading or parsing products.json:', error.message);
        products = [];
    }
} else {
    console.warn('products.json not found at:', productsPath, 'using empty product list');
    products = [];
}

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

app.get('/product/:id', (req, res) => {
    try {
        const product = products.find(p => p.id === req.params.id);
        if (!product) {
            return res.status(404).render('error', { message: 'Product not found.' });
        }
        res.render('product', { product });
    } catch (error) {
        console.error('Error in product route:', error.stack);
        res.status(500).render('error', { message: 'Internal Server Error - An unexpected error occurred.' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});