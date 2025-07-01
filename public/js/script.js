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
        // Call updateCartTotal from products.js to update the total
        if (typeof updateCartTotal === 'function') {
            updateCartTotal();
            console.log('Cart total updated');
        } else {
            console.error('updateCartTotal function not available');
        }
    });

    // Initial grid render
    updateProductGrid(originalProducts);
});