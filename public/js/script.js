// public/js/script.js
console.log('script.js loaded');

document.addEventListener('DOMContentLoaded', () => {
  window.cart = JSON.parse(localStorage.getItem('cart')) || {};
  let currency = 'USD';
  let exchangeRate = 1;

  // Fetch user location and set currency
  async function setUserCurrency() {
    try {
      const response = await axios.get('https://ipapi.co/json/');
      const countryCode = response.data.country_code;
      const currencyMap = {
        'KE': 'KES',
        'US': 'USD',
        'GB': 'GBP',
        'EU': 'EUR'
      };
      currency = currencyMap[countryCode] || 'USD';
      if (currency !== 'USD') {
        const rateResponse = await axios.get(`https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY || '8595f204349a4fe26ad731b1'}/latest/USD`);
        exchangeRate = rateResponse.data.conversion_rates[currency] || 1;
      }
      updateProductGrid(window.products);
    } catch (error) {
      console.error('Error fetching location/currency:', error);
    }
  }

  // Load products
  const productsDataRaw = document.getElementById('products-data').textContent;
  let productsData = [];
  try {
    productsData = JSON.parse(productsDataRaw);
    window.products = productsData;
    setUserCurrency();
  } catch (e) {
    console.error('Failed to parse products data:', e);
    return;
  }

  const originalProducts = [...productsData];
  let isPayPalInitialized = false;
  let searchTimeout = null;

  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchInput');
  const resetSearch = document.getElementById('resetSearch');
  const productGrid = document.getElementById('productGrid');
  const categoryFilter = document.getElementById('categoryFilter');
  const checkoutForm = document.getElementById('checkoutForm');
  const trackOrderForm = document.getElementById('trackOrderForm');

  // Handle search input with debounce
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(filterProducts, 500);
  });

  // Handle category filter change
  categoryFilter.addEventListener('change', () => {
    clearTimeout(searchTimeout);
    filterProducts();
  });

  // Handle form submission
  searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearTimeout(searchTimeout);
    filterProducts();
  });

  // Handle reset button
  resetSearch.addEventListener('click', () => {
    searchInput.value = '';
    categoryFilter.value = '';
    updateProductGrid(originalProducts);
  });

  // Filter products
  async function filterProducts() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const selectedCategory = categoryFilter.value.trim();
    try {
      const response = await window.axios.get('/data/products.json');
      const products = response.data.map(product => ({
        id: product.id || `temp-id-${Math.random().toString(36).substr(2, 9)}`,
        title: product.title || 'Unnamed Product',
        price: parseFloat(product.price) || 0,
        image: product.images && product.images[0] ? product.images[0] : 'https://via.placeholder.com/150',
        additionalImages: product.images && product.images.length > 1 ? product.images.slice(1) : [],
        category: product.category || 'Uncategorized'
      })).filter(product => {
        const matchesSearch = searchTerm ? product.title.toLowerCase().includes(searchTerm) : true;
        const matchesCategory = selectedCategory ? product.category === selectedCategory : true;
        return matchesSearch && matchesCategory;
      });
      updateProductGrid(products);
    } catch (error) {
      console.error('Error fetching products:', error);
      const filteredProducts = originalProducts.filter(product => {
        const matchesSearch = searchTerm ? product.title.toLowerCase().includes(searchTerm) : true;
        const matchesCategory = selectedCategory ? product.category === selectedCategory : true;
        return matchesSearch && matchesCategory;
      });
      updateProductGrid(filteredProducts);
    }
  }

  function updateProductGrid(products) {
    productGrid.innerHTML = '';
    if (!products || products.length === 0) {
      productGrid.innerHTML = '<p>No products match your search.</p>';
      return;
    }
    products.forEach(product => {
      const safeTitle = product.title.replace(/[<>&"']/g, '');
      const safeImage = product.image && product.image !== '' ? product.image : 'https://via.placeholder.com/150';
      const convertedPrice = (product.price * exchangeRate).toFixed(2);
      const div = document.createElement('div');
      div.className = 'product-card';
      div.innerHTML = `
        <div class="product-carousel" data-product-id="${product.id}">
          <div class="carousel-main">
            <img src="${safeImage}" alt="${safeTitle}" class="main-image" onerror="this.src='https://via.placeholder.com/150';">
          </div>
          <div class="carousel-thumbnails">
            ${product.additionalImages.length > 0 ? product.additionalImages.map((img, index) => `
              <div class="carousel-slide thumbnail">
                <img src="${img || 'https://via.placeholder.com/60'}" alt="${safeTitle} - Thumbnail ${index + 1}" onerror="this.src='https://via.placeholder.com/60';">
              </div>
            `).join('') : `
              <div class="carousel-slide thumbnail">
                <img src="https://via.placeholder.com/60" alt="${safeTitle} - No Thumbnail">
              </div>
            `}
          </div>
        </div>
        <h3><a href="/product/${product.id}">${safeTitle}</a></h3>
        <p>${currency} ${convertedPrice}</p>
        <button class="add-to-cart" data-product-id="${product.id}">Add to Cart</button>
      `;
      productGrid.appendChild(div);
    });

    productGrid.querySelectorAll('.add-to-cart').forEach(button => {
      button.addEventListener('click', (e) => {
        const productId = e.currentTarget.getAttribute('data-product-id');
        addToCart(productId);
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

  function addToCart(productId) {
    const product = window.products.find(p => p.id === productId);
    if (!product) return;
    if (!window.cart[productId]) {
      window.cart[productId] = {
        title: product.title,
        price: product.price,
        quantity: 0
      };
    }
    window.cart[productId].quantity += 1;
    localStorage.setItem('cart', JSON.stringify(window.cart));
    updateCartTotal();
    window.dispatchEvent(new Event('cartUpdated'));
  }

  window.addEventListener('cartUpdated', () => {
    updateCartTotal();
    localStorage.setItem('cart', JSON.stringify(window.cart));
  });

  // Update cart total with currency conversion
  window.updateCartTotal = function() {
    const cartItems = document.getElementById('cartItems');
    if (!cartItems) return;
    let total = 0;
    cartItems.innerHTML = '';
    for (const productId in window.cart) {
      const item = window.cart[productId];
      total += item.price * item.quantity * exchangeRate;
      const li = document.createElement('li');
      li.innerHTML = `
        ${item.title} - ${currency} ${(item.price * exchangeRate).toFixed(2)} x ${item.quantity}
        <button class="remove-from-cart" data-product-id="${productId}">Remove</button>
      `;
      cartItems.appendChild(li);
    }
    document.getElementById('cartTotal').textContent = total.toFixed(2);
    document.querySelectorAll('.remove-from-cart').forEach(button => {
      button.addEventListener('click', (e) => {
        const productId = e.currentTarget.getAttribute('data-product-id');
        delete window.cart[productId];
        localStorage.setItem('cart', JSON.stringify(window.cart));
        updateCartTotal();
        window.dispatchEvent(new Event('cartUpdated'));
      });
    });
  };

  const cartIcon = document.getElementById('cartIcon');
  const cartPanel = document.getElementById('cartPanel');
  const closeCart = document.getElementById('closeCart');
  if (cartIcon && cartPanel) {
    cartPanel.classList.remove('active');
    cartIcon.addEventListener('click', () => {
      cartPanel.classList.toggle('active');
      if (cartPanel.classList.contains('active') && !isPayPalInitialized && !document.querySelector('#cartPaypalButton .paypal-buttons')) {
        window.initializePayPalButton();
      }
    });
  }
  if (closeCart) {
    closeCart.addEventListener('click', () => {
      cartPanel.classList.remove('active');
    });
  }

  // Initialize PayPal Button
  window.initializePayPalButton = function() {
    if (window.paypal && !document.querySelector('#cartPaypalButton .paypal-buttons')) {
      document.getElementById('cartPaypalButton').innerHTML = '';
      isPayPalInitialized = true;
      paypal.Buttons({
        createOrder: (data, actions) => {
          const termsCheckbox = document.getElementById('termsCheckbox');
          if (!termsCheckbox.checked) {
            alert('Please agree to the Terms and Conditions.');
            return Promise.reject('Terms not accepted');
          }
          const cartTotal = document.getElementById('cartTotal').textContent || '0.00';
          return actions.order.create({
            purchase_units: [{
              amount: {
                value: (parseFloat(cartTotal) / exchangeRate).toFixed(2),
                currency_code: 'USD'
              }
            }]
          });
        },
        onApprove: (data, actions) => {
          return actions.order.capture().then((details) => {
            const name = document.getElementById('name').value;
            const phone = document.getElementById('phone').value;
            const address = document.getElementById('address').value;
            const orderData = {
              name,
              phone,
              address,
              paymentMethod: 'paypal',
              cart: window.cart
            };
            axios.post('/create-order', orderData).then(response => {
              if (response.data.success) {
                alert(`Order placed successfully! Order ID: ${response.data.orderId} (Copy this ID to track your order)`);
                window.cart = {};
                localStorage.setItem('cart', JSON.stringify(window.cart));
                document.getElementById('cartItems').innerHTML = '';
                updateCartTotal();
                isPayPalInitialized = false;
                cartPanel.classList.remove('active');
                checkoutForm.reset();
              } else {
                alert('Order creation failed: ' + response.data.error);
              }
            }).catch(error => {
              console.error('Error creating PayPal order:', error);
              alert('Failed to create order.');
            });
          });
        },
        onError: (err) => {
          console.error('PayPal Button Error:', err);
          isPayPalInitialized = false;
          document.getElementById('cartPaypalButton').innerHTML = '<p>PayPal is unavailable. Please try another payment method.</p>';
        }
      }).render('#cartPaypalButton').catch(err => {
        console.error('PayPal button rendering failed:', err);
        document.getElementById('cartPaypalButton').innerHTML = '<p>PayPal is unavailable. Please try another payment method.</p>';
        isPayPalInitialized = false;
      });
    }
  };

  // Handle checkout form submission
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('name').value;
      const phone = document.getElementById('phone').value;
      const address = document.getElementById('address').value;
      const paymentMethod = document.getElementById('paymentMethod').value;
      const termsCheckbox = document.getElementById('termsCheckbox');

      if (!termsCheckbox.checked) {
        alert('Please agree to the Terms and Conditions.');
        return;
      }

      if (Object.keys(window.cart).length === 0) {
        alert('Your cart is empty. Please add items before checking out.');
        return;
      }

      const orderData = { name, phone, address, paymentMethod, cart: window.cart };
      try {
        const response = await axios.post('/create-order', orderData);
        if (response.data.success) {
          alert(`Order placed successfully! Order ID: ${response.data.orderId} (Copy this ID to track your order)`);
          window.cart = {};
          localStorage.setItem('cart', JSON.stringify(window.cart));
          updateCartTotal();
          checkoutForm.reset();
          cartPanel.classList.remove('active');
          if (trackOrderForm) {
            trackOrderForm.reset();
            document.getElementById('trackResult').innerHTML = '';
          }
        } else {
          alert('Order creation failed: ' + response.data.error);
        }
      } catch (error) {
        console.error('Error creating order:', error);
        alert('Failed to create order. Please try again.');
      }
    });
  }

  // Handle track order form submission
  if (trackOrderForm) {
    trackOrderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      let orderId = document.getElementById('trackOrderId').value.trim();
      // Remove any "Order " prefix and validate UUID format
      orderId = orderId.replace(/^Order\s+/i, '');
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(orderId)) {
        document.getElementById('trackResult').innerHTML = '<p>Invalid Order ID format. Please enter a valid Order ID.</p>';
        return;
      }
      try {
        const response = await axios.get(`/track-order/${orderId}`);
        if (response.data.success) {
          const order = response.data.order;
          document.getElementById('trackResult').innerHTML = `
            <p>Order ID: ${order.orderId}</p>
            <p>Status: ${order.status}</p>
            <p>Created: ${new Date(order.createdAt).toLocaleString()}</p>
            <p>Items: ${Object.values(order.cart).map(item => `${item.title} (x${item.quantity})`).join(', ')}</p>
          `;
        } else {
          document.getElementById('trackResult').innerHTML = '<p>Order not found. Please check the Order ID.</p>';
        }
      } catch (error) {
        console.error('Error tracking order:', error.message);
        document.getElementById('trackResult').innerHTML = '<p>Error tracking order. Please try again later.</p>';
      }
    });
  }
});