// public/js/script.js
console.log('script.js loaded');

document.addEventListener('DOMContentLoaded', () => {
  window.cart = JSON.parse(localStorage.getItem('cart')) || {};
  const productsDataRaw = document.getElementById('products-data').textContent;
  let productsData = [];
  try {
    productsData = JSON.parse(productsDataRaw);
    window.products = productsData;
    console.log('Initial products:', productsData);
    console.log('window.products set:', productsData.length, 'items');
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

  // Filter products based on search term and category
  async function filterProducts() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const selectedCategory = categoryFilter.value.trim();
    console.log('Filtering with search:', searchTerm, 'category:', selectedCategory);

    try {
      const response = await window.axios.get('/data/products.json');
      console.log('Axios response data:', response.data);
      const products = response.data
        ? response.data.map(product => ({
            id: product.id || `temp-id-${Math.random().toString(36).substr(2, 9)}`,
            title: product.title || 'Unnamed Product',
            price: parseFloat(product.price) || 0,
            image: product.images && product.images[0] ? product.images[0] : 'https://via.placeholder.com/150',
            additionalImages: product.images && product.images.length > 1 ? product.images.slice(1) : [],
            category: product.category || 'Uncategorized'
          })).filter(product => {
            const matchesSearch = searchTerm ? product.title && product.title.toLowerCase().includes(searchTerm) : true;
            const matchesCategory = selectedCategory ? product.category === selectedCategory : true;
            return matchesSearch && matchesCategory;
          })
        : [];
      console.log('Axios filtered products:', products);
      updateProductGrid(products);
    } catch (error) {
      console.error('Error fetching products for search:', error);
      const filteredProducts = originalProducts.filter(product => {
        const matchesSearch = searchTerm ? product.title && product.title.toLowerCase().includes(searchTerm) : true;
        const matchesCategory = selectedCategory ? product.category === selectedCategory : true;
        return matchesSearch && matchesCategory;
      });
      console.log('Fallback filtered products:', filteredProducts);
      updateProductGrid(filteredProducts);
    }
  }

  function updateProductGrid(products) {
    console.log('Rendering products:', products);
    productGrid.innerHTML = '';
    if (!products || products.length === 0) {
      productGrid.innerHTML = '<p>No products match your search.</p>';
      return;
    }
    products.forEach(product => {
      const safeTitle = product.title ? product.title.replace(/[<>&"']/g, '') : 'Unnamed Product';
      const safeImage = product.image && product.image !== '' ? product.image : 'https://via.placeholder.com/150';
      const safeAdditionalImages = Array.isArray(product.additionalImages) ? product.additionalImages : [];
      console.log(`Product ${product.id}: main image=${safeImage}, thumbnails=`, safeAdditionalImages);

      const div = document.createElement('div');
      div.className = 'product-card';
      div.innerHTML = `
        <div class="product-carousel" data-product-id="${product.id || 'unknown'}">
          <div class="carousel-main">
            <img src="${safeImage}" alt="${safeTitle} - Main Image" class="main-image" onerror="this.onerror=null; console.error('Failed to load image: ${safeImage}'); this.src='https://via.placeholder.com/150';">
          </div>
          <div class="carousel-thumbnails">
            ${safeAdditionalImages.length > 0 ? safeAdditionalImages.map((img, index) => `
              <div class="carousel-slide thumbnail">
                <img src="${img && img !== '' ? img : 'https://via.placeholder.com/60'}" alt="${safeTitle} - Thumbnail ${index + 1}" onerror="this.onerror=null; console.error('Failed to load thumbnail: ${img}'); this.src='https://via.placeholder.com/60';">
              </div>
            `).join('') : `
              <div class="carousel-slide thumbnail">
                <img src="https://via.placeholder.com/60" alt="${safeTitle} - No Thumbnail" onerror="this.onerror=null; console.error('Failed to load default thumbnail'); this.src='https://via.placeholder.com/60';">
              </div>
            `}
          </div>
        </div>
        <h3><a href="/product/${product.id || 'unknown'}">${safeTitle}</a></h3>
        <p>$${parseFloat(product.price || 0).toFixed(2)}</p>
        <button class="add-to-cart" data-product-id="${product.id || 'unknown'}">Add to Cart</button>
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

  window.addEventListener('cartUpdated', () => {
    console.log('cartUpdated event triggered');
    updateCartTotal();
    localStorage.setItem('cart', JSON.stringify(window.cart));
    if (!isPayPalInitialized && !document.querySelector('#cartPaypalButton .paypal-buttons') && typeof window.initializePayPalButton === 'function') {
      console.log('Attempting to initialize PayPal button from cartUpdated');
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
        console.log('Cart opened, attempting to initialize PayPal button');
        window.initializePayPalButton();
      }
    });
  }
  if (closeCart) {
    closeCart.addEventListener('click', () => {
      cartPanel.classList.remove('active');
    });
  }

  // Initial render
  updateProductGrid(originalProducts);

  window.initializePayPalButton = function() {
    console.log('initializePayPalButton called');
    if (window.paypal && !document.querySelector('#cartPaypalButton .paypal-buttons')) {
      console.log('PayPal SDK available, rendering button');
      document.getElementById('cartPaypalButton').innerHTML = '';
      isPayPalInitialized = true;
      paypal.Buttons({
        createOrder: (data, actions) => {
          const termsCheckbox = document.getElementById('termsCheckbox');
          console.log('createOrder called, termsCheckbox checked:', termsCheckbox.checked);
          if (!termsCheckbox.checked) {
            alert('Please agree to the Terms and Conditions.');
            return Promise.reject('Terms not accepted');
          }
          const cartTotal = document.getElementById('cartTotal').textContent || '0.00';
          console.log('Creating order with total:', cartTotal);
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
          console.log('Order approved:', data);
          return actions.order.capture().then((details) => {
            alert('Transaction completed by ' + (details.payer.name?.given_name || 'User'));
            window.cart = {};
            localStorage.setItem('cart', JSON.stringify(window.cart));
            document.getElementById('cartItems').innerHTML = '';
            updateCartTotal();
            isPayPalInitialized = false;
          });
        },
        onError: (err) => {
          console.error('PayPal Button Error:', err);
          isPayPalInitialized = false;
        }
      }).render('#cartPaypalButton').then(() => {
        console.log('PayPal button rendered successfully');
      }).catch(err => {
        console.error('PayPal button rendering failed:', err);
        document.getElementById('cartPaypalButton').innerHTML = '<p>PayPal is unavailable. Please try again later.</p>';
        isPayPalInitialized = false;
      });
    } else {
      if (!window.paypal) {
        console.error('PayPal SDK not loaded');
        document.getElementById('cartPaypalButton').innerHTML = '<p>PayPal is unavailable. Please try again later.</p>';
      } else {
        console.log('PayPal button already exists, skipping render');
      }
    }
  };
});