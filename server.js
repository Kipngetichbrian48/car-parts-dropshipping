require('dotenv').config();
console.log('Dotenv loaded:', process.env);
console.log('PayPal Client ID from env:', process.env.PAYPAL_CLIENT_ID);
console.log('PayPal API URL:', process.env.PAYPAL_API || 'https://api-m.sandbox.paypal.com');
console.log('Assigned PORT:', process.env.PORT);

const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// Serve static files explicitly for Vercel
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));
app.use('/data', express.static(path.join(__dirname, 'public', 'data')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
console.log('Views directory:', app.get('views'));

let products;
try {
    products = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'data', 'products.json'), 'utf8'));
} catch (err) {
    console.error('Error loading products.json:', err.message);
    products = [];
}

app.get('/', (req, res) => {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    if (!clientId) {
        console.error('PAYPAL_CLIENT_ID is not set in environment');
        res.status(500).send('Environment variable PAYPAL_CLIENT_ID is missing');
        return;
    } else {
        console.log('Rendered PayPal Client ID:', clientId);
    }
    res.render('index', {
        clientId: clientId || 'ARHCurM20tcpYdV026Dzfj3x7JelmaAUpitT-qNwrI4GSNkTuZmgBO-dEwu3z-FjwitHJnQPa0SsHSCG',
        paypalApi: process.env.PAYPAL_API || 'https://api-m.sandbox.paypal.com',
        products: products
    });
});

module.exports = app;

if (require.main === module) {
    const port = process.env.PORT || 10000;
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});