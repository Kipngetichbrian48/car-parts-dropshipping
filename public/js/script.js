console.log('script.js loaded');

document.addEventListener('DOMContentLoaded', () => {
    window.cart = JSON.parse(localStorage.getItem('cart')) || {};
    const productsDataRaw = document.getElementById('products-data').textContent;
    let productsData = [];
    try {
        productsData = JSON.parse(productsDataRaw);
        window.products = productsData;
        console.log('Parsed products:', window.products);
        console.log('window.products set:', window.products.length, 'items');
    } catch (e) {
        console.error('Failed to parse products data:', e);
        return;
    }

    const originalProducts = [...productsData];
    let isPayPalInitialized = false;

    const searchForm = document.getElementById('searchForm');
    const searchInput = document.getElementById('searchInput');
    const resetSearch = document.getElementById('resetSearch');
    const productGrid = document.getElementById('productGrid');
    const categoryFilter = document.getElementById('categoryFilter');

    // Search with Axios
    searchInput.addEventListener('input', async () => {
        const searchTerm = searchInput.value.trim().toLowerCase();
        try {
            const response = await window.axios.get('/data/products.json');
            const products = response.data.filter(product =>
                product.title.toLowerCase().includes(searchTerm)
            );
            console.log('Axios search products:', products);
            updateProductGrid(products);
        } catch (error) {
            console.error('Error fetching products for search:', error);
            const filteredProducts = originalProducts.filter(product =>
                product.title.toLowerCase().includes(searchTerm)
            );
            console.log('Fallback search products:', filteredProducts);
            updateProductGrid(filteredProducts);
        }
    });

    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const searchTerm = searchInput.value.trim().toLowerCase();
        const selectedCategory = categoryFilter.value;
        try {
            const response = await window.axios.get('/data/products.json');
            const filteredProducts = response.data.filter(product => {
                const matchesSearch = searchTerm ? product.title.toLowerCase().includes(searchTerm) : true;
                const matchesCategory = selectedCategory ? product.category === selectedCategory : true;
                return matchesSearch && matchesCategory;
            });
            console.log('Axios filtered products:', filteredProducts);
            updateProductGrid(filteredProducts);
        } catch (error) {
            console.error('Error fetching products:', error);
            const filteredProducts = originalProducts.filter(product => {
                const matchesSearch = searchTerm ? product.title.toLowerCase().includes(searchTerm) : true;
                const matchesCategory = selectedCategory ? product.category === selectedCategory : true;
                return matchesSearch && matchesCategory;
            });
            console.log('Fallback filtered products:', filteredProducts);
            updateProductGrid(filteredProducts);
        }
    });

    resetSearch.addEventListener('click', () => {
        searchInput.value = '';
        categoryFilter.value = '';
        document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector('.category-btn[data-category=""]').classList.add('active');
        updateProductGrid(originalProducts);
    });

    function updateProductGrid(products) {
        console.log('Rendering products:', products);
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
                <h3><a href="/product/${product.id}">${product.title || 'Unnamed Product'}</a></h3>
                <p>$${parseFloat(product.price || 0).toFixed(2)}</p>
                <button class="add-to-cart" data-product-id="${product.id}">Add to Cart</button>
            `;
            productGrid.appendChild(div);
        });

        productGrid.querySelectorAll('.add-to-cart').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.currentTarget.getAttribute('data-product-id');
                try {
                    addToCart(productId);
                } catch (error) {
                    console.error('Error calling addToCart for productId:', productId, error);
                }
            });
        });

        productGrid.querySelectorAll('.carousel-thumbnails .thumbnail img').forEach(thumb => {
            thumb.addEventListener('click', (e) => {
                const carousel = e.target.closest('.product-carousel');
                const mainImage = carousel.querySelector('.main-image');
                mainImage.src = e.target.src;
                mainImage.alt = e.target.alt;
            });
        });
    }

    document.querySelectorAll('.category-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const category = button.getAttribute('data-category');
            const filteredProducts = category
                ? originalProducts.filter(product => product.category === category)
                : [...originalProducts];
            console.log('Category filtered products:', filteredProducts);
            updateProductGrid(filteredProducts);
            categoryFilter.value = category;
            searchInput.value = '';
        });
    });

    window.addEventListener('cartUpdated', () => {
        console.log('cartUpdated event triggered'); // Debug
        updateCartTotal();
        localStorage.setItem('cart', JSON.stringify(window.cart));
        if (!isPayPalInitialized && !document.querySelector('#cartPaypalButton .paypal-buttons') && typeof window.initializePayPalButton === 'function') {
            console.log('Attempting to initialize PayPal button from cartUpdated'); // Debug
            window.initializePayPalButton();
        }
    });

    const cartIcon = document.getElementById('cartIcon');
    const cartPanel = document.getElementById('cartPanel');
    const closeCart = document.getElementById('closeCart');
    if (cartIcon && cartPanel) {
        cartPanel.classList.remove('active');
        cartIcon.addEventListener('click', () => {
            cartPanel.classList.toggle('active');
            if (cartPanel.classList.contains('active') && !isPayPalInitialized && !document.querySelector('#cartPaypalButton .paypal-buttons') && typeof window.initializePayPalButton === 'function') {
                console.log('Cart opened, attempting to initialize PayPal button'); // Debug
                window.initializePayPalButton();
            }
        });
    }
    if (closeCart) {
        closeCart.addEventListener('click', () => {
            cartPanel.classList.remove('active');
        });
    }

    updateProductGrid(originalProducts);

    window.initializePayPalButton = function() {
        console.log('initializePayPalButton called'); // Debug
        if (window.paypal && !document.querySelector('#cartPaypalButton .paypal-buttons')) {
            console.log('PayPal SDK available, rendering button'); // Debug
            // Clear existing content in #cartPaypalButton
            document.getElementById('cartPaypalButton').innerHTML = '';
            isPayPalInitialized = true; // Set flag to prevent re-rendering
            paypal.Buttons({
                createOrder: (data, actions) => {
                    const termsCheckbox = document.getElementById('termsCheckbox');
                    console.log('createOrder called, termsCheckbox checked:', termsCheckbox.checked); // Debug
                    if (!termsCheckbox.checked) {
                        alert('Please agree to the Terms and Conditions.');
                        return Promise.reject('Terms not accepted');
                    }
                    const cartTotal = document.getElementById('cartTotal').textContent || '0.00';
                    console.log('Creating order with total:', cartTotal); // Debug
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
                    console.log('Order approved:', data); // Debug
                    return actions.order.capture().then((details) => {
                        alert('Transaction completed by ' + (details.payer.name?.given_name || 'User'));
                        window.cart = {};
                        localStorage.setItem('cart', JSON.stringify(window.cart));
                        document.getElementById('cartItems').innerHTML = '';
                        updateCartTotal();
                        isPayPalInitialized = false; // Allow re-initialization after checkout
                    });
                },
                onError: (err) => {
                    console.error('PayPal Button Error:', err); // Debug
                    isPayPalInitialized = false; // Retry on error
                }
            }).render('#cartPaypalButton').then(() => {
                console.log('PayPal button rendered successfully'); // Debug
            }).catch(err => {
                console.error('PayPal button rendering failed:', err); // Debug
                document.getElementById('cartPaypalButton').innerHTML = '<p>PayPal is unavailable. Please try again later.</p>';
                isPayPalInitialized = false; // Retry on error
            });
        } else {
            if (!window.paypal) {
                console.error('PayPal SDK not loaded'); // Debug
                document.getElementById('cartPaypalButton').innerHTML = '<p>PayPal is unavailable. Please try again later.</p>';
            } else {
                console.log('PayPal button already exists, skipping render'); // Debug
            }
        }
    };
});