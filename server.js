require('dotenv').config();

console.log('Dotenv config loaded, process.env:', process.env);

const express = require('express');
const path = require('path');
const app = express();

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'public'));

app.use(express.static('public'));

app.get('/', (req, res) => {
    const clientId = process.env.PAYPAL_CLIENT_ID || 'YOUR_SANDBOX_CLIENT_ID_FALLBACK';
    console.log('Environment PAYPAL_CLIENT_ID:', process.env.PAYPAL_CLIENT_ID);
    console.log('Rendered PayPal Client ID:', clientId);
    res.render('index.html', {
        paypalClientId: clientId,
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