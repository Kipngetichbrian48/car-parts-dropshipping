import { addToCart, updateCartTotal } from './products.js';

console.log('script.js loaded');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded, addToCart is available:', typeof addToCart === 'function');

    // Initialize cart
    window.cart = window.cart || {};

    // Load products data
    const productsDataRaw = document.getElementById('products-data').textContent;
    let productsData = [];
    try {
        productsData = JSON.parse(productsDataRaw);
        console.log('Parsed products data:', productsData.length, 'items');
        // Set window.products for addToCart in products.js
        window.products = productsData;
        console.log('window.products set:', window.products.length, 'items');
    } catch (e) {
        console.error('Failed to parse products data:', e);
        return;
    }

    // Store original products for reset
    const originalProducts = [...productsData];

    // Flag to track PayPal button initialization
    let isPayPalInitialized = false;

    // Initialize search
    const searchForm = document.getElementById('searchForm');
    const searchInput = document.getElementById('searchInput');
    const resetSearch = document.getElementById('resetSearch');
    const productGrid = document.getElementById('productGrid');

    // Handle search
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const searchTerm = searchInput.value.trim().toLowerCase();
        const filteredProducts = searchTerm
            ? originalProducts.filter(product => product.title.toLowerCase().includes(searchTerm))
            : [...originalProducts];
        updateProductGrid(filteredProducts);
    });

    // Handle reset
    resetSearch.addEventListener('click', () => {
        searchInput.value = '';
        updateProductGrid(originalProducts);
    });

    // Update product grid
    function updateProductGrid(products) {
        productGrid.innerHTML = '';
        if (products.length === 0) {
            productGrid.innerHTML = '<p>No products match your search.</p>';
            return;
        }
        products.forEach(product => {
            const div = document.createElement('div');
            div.className = 'product-card';
            div.innerHTML = `
                <div class="product-carousel" data-product-id="${product.id}">
                    <div class="carousel-main">
                        <img src="${product.image || 'https://via.placeholder.com/150'}" alt="${product.title || 'Product'} - Main Image" class="main-image" onerror="this.src='https://via.placeholder.com/150';">
                    </div>
                    <div class="carousel-thumbnails">
                        ${(product.additionalImages || []).map((img, index) => `
                            <div class="carousel-slide thumbnail">
                                <img src="${img}" alt="${product.title || 'Product'} - Thumbnail ${index + 1}" onerror="this.src='https://via.placeholder.com/60';">
                            </div>
                        `).join('') || `
                            <div class="carousel-slide thumbnail">
                                <img src="https://via.placeholder.com/60" alt="No Thumbnail">
                            </div>
                        `}
                    </div>
                </div>
                <h3>${product.title || 'Unnamed Product'}</h3>
                <p>$${parseFloat(product.price || 0).toFixed(2)}</p>
                <button class="add-to-cart" data-product-id="${product.id}">Add to Cart</button>
            `;
            productGrid.appendChild(div);
        });

        // Reattach event listeners for Add to Cart buttons
        productGrid.querySelectorAll('.add-to-cart').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.currentTarget.getAttribute('data-product-id');
                console.log('Add to Cart clicked for productId:', productId);
                try {
                    addToCart(productId);
                } catch (error) {
                    console.error('Error calling addToCart for productId:', productId, error);
                }
            });
        });
    }

    // Initialize cart buttons for initial page load
    productGrid.querySelectorAll('button[data-product-id]').forEach(button => {
        button.addEventListener('click', (e) => {
            const productId = e.currentTarget.getAttribute('data-product-id');
            console.log('Initial Add to Cart clicked for productId:', productId);
            try {
                addToCart(productId);
            } catch (error) {
                console.error('Error calling addToCart for productId:', productId, error);
            }
        });
    });

    // Update cart on custom event
    window.addEventListener('cartUpdated', () => {
        console.log('cartUpdated event received');
        if (typeof updateCartTotal === 'function') {
            updateCartTotal();
            console.log('Cart total updated');
            // Initialize PayPal button only if not already initialized
            if (!isPayPalInitialized && typeof window.initializePayPalButton === 'function') {
                window.initializePayPalButton();
                isPayPalInitialized = true;
            }
        } else {
            console.error('updateCartTotal function not available');
        }
    });

    // Toggle cart panel on icon click
    const cartIcon = document.getElementById('cartIcon');
    const cartPanel = document.getElementById('cartPanel');
    const closeCart = document.getElementById('closeCart');
    if (cartIcon && cartPanel) {
        cartIcon.addEventListener('click', () => {
            cartPanel.classList.toggle('active');
            console.log('Cart panel toggled');
            // Initialize PayPal button only on first open if not already initialized
            if (cartPanel.classList.contains('active') && !isPayPalInitialized && typeof window.initializePayPalButton === 'function') {
                window.initializePayPalButton();
                isPayPalInitialized = true;
            }
        });
    } else {
        console.error('Cart icon or panel not found');
    }
    if (closeCart) {
        closeCart.addEventListener('click', () => {
            cartPanel.classList.remove('active');
            console.log('Cart panel closed');
        });
    } else {
        console.error('Close cart button not found');
    }

    // Initial grid render
    updateProductGrid(originalProducts);

    // Define initializePayPalButton globally
    window.initializePayPalButton = function() {
        if (window.paypal && !document.querySelector('#cartPaypalButton .paypal-button')) {
            paypal.Buttons({
                createOrder: (data, actions) => {
                    const cartTotal = document.getElementById('cartTotal').textContent || '0.00';
                    return actions.order.create({
                        purchase_units: [{
                            amount: {
                                value: cartTotal,
                                currency_code: 'USD'
                            }
                        }]
                    });
                },
                onApprove: (data, actions) => {
                    return actions.order.capture().then((details) => {
                        alert('Transaction completed by ' + (details.payer.name?.given_name || 'User'));
                    });
                },
                onError: (err) => {
                    console.error('PayPal Button Error:', err);
                }
            }).render('#cartPaypalButton');
            console.log('PayPal button initialized');
        } else {
            console.log('PayPal button already initialized or SDK not available');
        }
    };
});