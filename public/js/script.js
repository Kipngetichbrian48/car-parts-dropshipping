import { fetchProducts } from './products.js';

let cart = [];

// Set up MutationObserver to monitor DOM changes asynchronously
const observer = new MutationObserver((mutations) => {
    let needsUpdate = false;
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
            console.log('DOM mutation detected - New nodes added:', mutation.addedNodes);
            needsUpdate = true;
        }
    });
    if (needsUpdate) {
        initializeProductButtons();
    }
});

// Start observing and disconnect after initial setup
document.addEventListener('DOMContentLoaded', async () => {
    const productGrid = document.getElementById('productGrid');
    if (productGrid) {
        observer.observe(document.body, { childList: true, subtree: true });
        await loadProducts();
        observer.disconnect(); // Disconnect after initial load
    }

    // Checkout button event
    document.getElementById('checkoutButton').addEventListener('click', () => {
        document.getElementById('cart').style.display = 'none';
        document.getElementById('checkout').style.display = 'block';
    });

    // Checkout form submission
    document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const customer = Object.fromEntries(formData);

        const response = await fetch('/create-paypal-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: cart })
        });
        const orderData = await response.json();

        if (orderData.id) {
            const approvalUrl = orderData.links.find(link => link.rel === 'approve').href;
            window.location.href = approvalUrl;
        } else {
            alert('Failed to create PayPal order');
        }
    });

    // PayPal Buttons configuration
    window.paypal.Buttons({
        createOrder: (data, actions) => {
            return actions.order.create({
                purchase_units: [{
                    items: cart.map(item => ({
                        name: item.title,
                        quantity: '1',
                        unit_amount: { currency_code: 'USD', value: item.price }
                    })),
                    amount: {
                        currency_code: 'USD',
                        value: cart.reduce((sum, item) => sum + item.price, 0).toFixed(2),
                        breakdown: {
                            item_total: {
                                currency_code: 'USD',
                                value: cart.reduce((sum, item) => sum + item.price, 0).toFixed(2)
                            }
                        }
                    }
                }]
            });
        },
        onApprove: async (data, actions) => {
            const captureResponse = await fetch('/capture-paypal-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderID: data.orderID, items: cart, customer })
            });
            const captureResult = await captureResponse.json();
            if (captureResult.status === 'COMPLETED') {
                alert('Payment completed! Order logged for manual processing.');
                window.location.href = '/success';
            }
        },
        onCancel: () => {
            window.location.href = '/cancel';
        }
    }).render('#checkoutForm');
});

// Function to load products and initialize the grid
async function loadProducts() {
    const products = await fetchProducts();
    const productGrid = document.getElementById('productGrid');
    if (productGrid) {
        productGrid.innerHTML = ''; // Clear existing content
        products.forEach(product => {
            const div = document.createElement('div');
            div.innerHTML = `<h3>${product.title || 'Unnamed Part'}</h3><img src="${product.image}" alt="${product.title || 'Car Part'}" width="100"><button class="add-to-cart" data-id="${product.id}">Add to Cart</button>`;
            productGrid.appendChild(div);
        });
        initializeProductButtons(); // Attach initial event listeners
    }
}

// Function to initialize or re-initialize product buttons
function initializeProductButtons() {
    document.querySelectorAll('.add-to-cart').forEach(button => {
        button.removeEventListener('click', addToCartHandler); // Avoid duplicate listeners
        button.addEventListener('click', addToCartHandler);
    });
}

// Handler function for adding to cart
function addToCartHandler(e) {
    const productId = e.target.getAttribute('data-id');
    addToCart(productId);
}

window.addToCart = async (productId) => {
    const product = (await fetchProducts()).find(p => p.id === productId);
    if (product && product.price) { //Ensure price exists}) {
        cart.push({ ...product }); // Create a new object to avoid reference issues
        updateCart();
    } else {
        console.error(`Product ${productId} has no price or is invalid`);
    }
}

function updateCart() {
    const cartItems = document.getElementById('cartItems');
    if (cartItems) {
        cartItems.innerHTML = '';
        cart.forEach(item => {
            const li = document.createElement('li');
            li.textContent = `${item.title || item.id} - $${item.price}`;
            cartItems.appendChild(li);
        });
        document.getElementById('cartTotal').textContent = cart.reduce((sum, item) => sum + item.price, 0).toFixed(2);
        document.getElementById('cart').style.display = 'block';
    }
}