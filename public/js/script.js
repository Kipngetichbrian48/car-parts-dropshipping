import { fetchProducts } from './products.js';

let cart = [];

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, starting initialization...');
    try {
        await initializeCart();
        await renderProducts();
        updateCart();
        setupPayPalButtons();
    } catch (error) {
        console.error('Initialization error:', error);
    }
});

async function initializeCart() {
    const products = await fetchProducts();
    console.log('Initialized cart with products:', products);
}

async function renderProducts() {
    console.log('Rendering products...');
    const productGrid = document.getElementById('productGrid');
    if (productGrid) {
        const products = await fetchProducts();
        console.log('Fetching products...', products);
        productGrid.innerHTML = '';
        if (products.length > 0) {
            products.forEach(product => {
                const div = document.createElement('div');
                div.className = 'product';
                div.innerHTML = `
                    <img src="${product.image}" alt="${product.title}">
                    <h3>${product.title}</h3>
                    <p>$${product.price}</p>
                    <button onclick="addToCart('${product.id}')">Add to Cart</button>
                `;
                productGrid.appendChild(div);
            });
        } else {
            productGrid.innerHTML = '<p>No products available.</p>';
            console.warn('No products fetched');
        }
    } else {
        console.error('Product grid element not found');
    }
}

window.addToCart = async (productId) => {
    const products = await fetchProducts();
    const product = products.find(p => p.id === productId);
    if (product && product.price) {
        cart.push({ ...product });
        updateCart();
    } else {
        console.error(`Product ${productId} has no price or is invalid`);
    }
};

function updateCart() {
    const cartItems = document.getElementById('cartItems');
    if (cartItems) {
        cartItems.innerHTML = '';
        cart.forEach(item => {
            const li = document.createElement('li');
            li.textContent = `${item.title || item.id} - $${item.price || 0}`;
            cartItems.appendChild(li);
        });
        const total = cart.reduce((sum, item) => sum + (item.price || 0), 0).toFixed(2);
        document.getElementById('cartTotal').textContent = total;
        console.log('Cart:', cart);
    }
}

function setupPayPalButtons() {
    console.log('Setting up PayPal buttons...');
    if (typeof paypal == 'undefined') {
        console.error('PayPal SDK not loaded, retrying...');
    } else {
        console.log('PayPal SDK loaded, rendering buttons...');
        window.paypal.Buttons({
            createOrder: (data, actions) => {
                return actions.order.create({
                    purchase_units: [{
                        items: cart.map(item => ({
                            name: item.title,
                            quantity: '1',
                            unit_amount: { currency_code: 'USD', value: (item.price || 0).toString() }
                        })),
                        amount: {
                            currency_code: 'USD',
                            value: cart.reduce((sum, item) => sum + (item.price || 0), 0).toFixed(2),
                            breakdown: {
                                item_total: {
                                    currency_code: 'USD',
                                    value: cart.reduce((sum, item) => sum + (item.price || 0), 0).toFixed(2)
                                }
                            }
                        }
                    }]
                });
            },
            onApprove: (data, actions) => {
                return actions.order.capture().then(details => {
                    alert('Transaction completed by ' + details.payer.name.given_name);
                });
            },
            onCancel: (data) => {
                alert('Payment cancelled');
            },
            onError: (err) => {
                console.error('PayPal Error (Standalone):', err);
                alert('Failed to create PayPal order. Check console for details.');
            }
        }).render('#paypal-button-container');

        const igniteButton = document.getElementById('ignitePurchase');
        if (igniteButton) {
            console.log('Ignite button found, setting up event...');
            igniteButton.addEventListener('click', async (e) => {
                e.preventDefault();
                if (cart.length === 0) {
                    alert('Please add items to the cart before purchasing.');
                    return;
                }
                try {
                    const order = await window.paypal.Buttons({
                        createOrder: (data, actions) => {
                            return actions.order.create({
                                purchase_units: [{
                                    items: cart.map(item => ({
                                        name: item.title,
                                        quantity: '1',
                                        unit_amount: { currency_code: 'USD', value: (item.price || 0).toString() }
                                    })),
                                    amount: {
                                        currency_code: 'USD',
                                        value: cart.reduce((sum, item) => sum + (item.price || 0), 0).toFixed(2),
                                        breakdown: {
                                            item_total: {
                                                currency_code: 'USD',
                                                value: cart.reduce((sum, item) => sum + (item.price || 0), 0).toFixed(2)
                                            }
                                        }
                                    },
                                    shipping: {
                                        name: { full_name: document.getElementById('name').value },
                                        address: {
                                            address_line_1: document.getElementById('address').value,
                                            admin_area_2: document.getElementById('city').value,
                                            admin_area_1: document.getElementById('province').value,
                                            postal_code: document.getElementById('zip').value,
                                            country_code: document.getElementById('countryCode').value
                                        }
                                    }
                                }]
                            });
                        },
                        onApprove: (data, actions) => {
                            return actions.order.capture().then(details => {
                                alert('Transaction completed by ' + details.payer.name.given_name);
                            });
                        },
                        onCancel: (data) => {
                            alert('Payment cancelled');
                        },
                        onError: (err) => {
                            console.error('PayPal Error (Ignite):', err);
                            alert('Failed to create PayPal order. Check console for details.');
                        }
                    }).render('#checkoutForm');
                } catch (error) {
                    console.error('PayPal Initialization Error:', error);
                    alert('Failed to initialize PayPal checkout. Check console.');
                }
            });
        } else {
            console.error('Ignite button not found');
        }
    }
}