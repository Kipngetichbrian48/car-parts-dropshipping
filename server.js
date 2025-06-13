const express = require('express');
const app = express();
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');

// Middleware to serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Environment variables
const PORT = process.env.PORT || 3000;
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
const PAYPAL_API = process.env.PAYPAL_API;

// PayPal access token function
async function getPayPalAccessToken() {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');
    const response = await axios.post(`${PAYPAL_API}/v1/oauth2/token`, 'grant_type=client_credentials', {
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
    return response.data.access_token;
}

// Create PayPal Order
app.post('/create-paypal-order', async (req, res) => {
    try {
        const accessToken = await getPayPalAccessToken();
        const { items } = req.body;

        const order = {
            intent: 'CAPTURE',
            purchase_units: [{
                items: items.map(item => ({
                    name: item.title,
                    quantity: '1',
                    unit_amount: { currency_code: 'USD', value: item.price || '29.99' }
                })),
                amount: {
                    currency_code: 'USD',
                    value: items.reduce((sum, item) => sum + (item.price || 29.99), 0).toFixed(2),
                    breakdown: {
                        item_total: {
                            currency_code: 'USD',
                            value: items.reduce((sum, item) => sum + (item.price || 29.99), 0).toFixed(2)
                        }
                    }
                }
            }],
            application_context: {
                return_url: 'http://localhost:3000/success',
                cancel_url: 'http://localhost:3000/cancel'
            }
        };

        const response = await axios.post(`${PAYPAL_API}/v2/checkout/orders`, order, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error creating PayPal order:', error);
        res.status(500).json({ error: 'Failed to create PayPal order' });
    }
});

// Capture PayPal Order and Log for DSers
app.post('/capture-paypal-order', async (req, res) => {
    try {
        const accessToken = await getPayPalAccessToken();
        const orderID = req.body.orderID;
        const items = req.body.items;
        const customer = req.body.customer;

        const captureResponse = await axios.post(`${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`, {}, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });
        const captureResult = captureResponse.data;

        if (captureResult.status === 'COMPLETED') {
            // Log order details for manual entry in DSers
            const orderDetails = {
                orderId: `ORDER_${orderID}`,
                customerName: customer.name,
                customerPhone: customer.phone,
                customerAddress: customer.address,
                customerCity: customer.city,
                customerProvince: customer.province,
                customerCountryCode: customer.countryCode,
                customerZip: customer.zip,
                items: items.map(item => ({
                    productId: item.id,
                    sku: item.sku || item.id,
                    quantity: 1,
                    price: item.price || 29.99
                }))
            };
            console.log('Manual Order to Place in DSers:', orderDetails);

            res.json({ status: 'COMPLETED', dsers_order_id: 'MANUAL_ENTRY' });
        } else {
            res.status(400).json({ error: 'PayPal payment not completed' });
        }
    } catch (error) {
        console.error('Error capturing order:', error);
        res.status(500).json({ error: 'Failed to capture order' });
    }
});

// Success and Cancel routes (placeholders)
app.get('/success', (req, res) => {
    res.send('Payment successful! Order details logged for manual processing.');
});

app.get('/cancel', (req, res) => {
    res.send('Payment cancelled.');
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});