require('dotenv').config();

console.log('PayPal Client ID:', process.env.PAYPAL_CLIENT_ID);
console.log('PayPal API URL:', process.env.PAYPAL_API || 'https://api-m.sandbox.paypal.com');

const express = require('express');
const path = require('path');
const app = express();

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'public'));

app.use(express.static('public'));

app.get('/', (req, res) => {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    if (!clientId) {
        console.error('PAYPAL_CLIENT_ID is not set in environment');
    } else {
        console.log('Rendered PayPal Client ID:', clientId);
    }
    res.render('index.html', {
        paypalClientId: clientId || 'YOUR_SANDBOX_CLIENT_ID_FALLBACK',
        paypalApi: process.env.PAYPAL_API || 'https://api-m.sandbox.paypal.com'
    });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
// app.js or index.js
// Ensure the PayPal Client ID is logged and available in the EJS template
app.get('/', (req, res) => {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    if (!clientId) {
        console.error('PAYPAL_CLIENT_ID is not set in environment');
    } else {
        console.log('Rendered PayPal Client ID:', clientId);
    }
    res.render('index.html', {
        paypalClientId: clientId || 'YOUR_SANDBOX_CLIENT_ID_FALLBACK',
        paypalApi: process.env.PAYPAL_API || 'https://api-m.sandbox.paypal.com'
    }, (err, html) => {
        if (err) {
            console.error('EJS Rendering Error:', err);
        } else {
            console.log('EJS Rendered HTML snippet:', html.substring(0, 100)); // First 100 chars
        }
    });
});