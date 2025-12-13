// public/js/script.js — FINAL, 100% WORKING
console.log('script.js loaded');

document.addEventListener('DOMContentLoaded', () => {
  window.cart = JSON.parse(localStorage.getItem('cart')) || {};
  window.products = window.products || [];

  let currency = 'USD';
  let exchangeRate = 1;
  let isPayPalInitialized = false;

  // CURRENCY DETECTION — WORKS ON ALL PAGES
  async function detectCurrency() {
    try {
      const res = await axios.get('https://ipapi.co/json/');
      const map = { 'KE': 'KES', 'US': 'USD', 'GB': 'GBP', 'EU': 'EUR' };
      currency = map[res.data.country_code] || 'USD';

      if (currency !== 'USD') {
        const rateRes = await axios.get('/api/exchange-rate', { params: { currency } });
        exchangeRate = rateRes.data.rate || 1;
      }

      // Update product page price
      const priceEl = document.querySelector('.product-price strong');
      if (priceEl) {
        const base = parseFloat(priceEl.dataset.price);
        priceEl.textContent = `${currency} ${(base * exchangeRate).toFixed(2)}`;
      }

      // Update homepage grid
      if (typeof window.updateProductGrid === 'function') {
        window.updateProductGrid(window.products);
      }

      // Update cart
      if (typeof window.updateCartTotal === 'function') {
        window.updateCartTotal();
      }
    } catch (e) {
      console.error('Currency failed:', e);
    }
  }

  detectCurrency();

  // HOMEPAGE: PRODUCT GRID
  const productsDataEl = document.getElementById('products-data');
  if (productsDataEl) {
    try {
      window.products = JSON.parse(productsDataEl.textContent);

      window.updateProductGrid = function (list) {
        const grid = document.getElementById('productGrid');
        if (!grid) return;
        grid.innerHTML = '';

        list.forEach(p => {
          const convertedPrice = (p.price * exchangeRate).toFixed(2);
          const mainImg = p.images?.[0] || 'https://placehold.co/600x600/orange/white?text=No+Image';
          const thumbs = p.images?.slice(1) || [];

          const div = document.createElement('div');
          div.className = 'product-card';
          div.innerHTML = `
            <div class="product-carousel" data-product-id="${p.id}">
              <div class="carousel-main">
                <img src="${mainImg}" alt="${p.title}" class="main-image" onerror="this.src='https://placehold.co/600x600/orange/white?text=No+Image'">
              </div>
              <div class="carousel-thumbnails">
                ${thumbs.length > 0
                  ? thumbs.map(img => `
                    <div class="carousel-slide thumbnail">
                      <img src="${img}" onerror="this.src='https://placehold.co/80x80/orange/white?text=Img'">
                    </div>`).join('')
                  : '<div class="carousel-slide thumbnail"><img src="https://placehold.co/80x80/orange/white?text=No+Img"></div>'
                }
              </div>
            </div>
            <h3><a href="/product/${p.id}">${p.title}</a></h3>
            <p>${currency} ${convertedPrice}</p>
            <button class="add-to-cart" data-product-id="${p.id}">Add to Cart</button>
          `;
          grid.appendChild(div);
        });

        document.querySelectorAll('.add-to-cart').forEach(btn => {
          btn.onclick = () => window.addToCart(btn.dataset.productId);
        });

        document.querySelectorAll('.carousel-thumbnails img').forEach(thumb => {
          thumb.onclick = () => {
            const main = thumb.closest('.product-carousel').querySelector('.main-image');
            main.src = thumb.src;
          };
        });
      };

      window.updateProductGrid(window.products);
    } catch (e) {
      console.error('Products load failed:', e);
    }
  }

  // CART UPDATE
  window.updateCartTotal = function () {
    const itemsEl = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotal');
    if (!itemsEl || !totalEl) return;

    let total = 0;
    itemsEl.innerHTML = '';

    for (const id in window.cart) {
      const item = window.cart[id];
      const price = item.price * exchangeRate;
      total += price * item.quantity;

      const li = document.createElement('li');
      li.innerHTML = `
        ${item.title} - ${currency} ${price.toFixed(2)} × ${item.quantity}
        <button class="remove-from-cart" data-id="${id}">Remove</button>`;
      itemsEl.appendChild(li);
    }

    totalEl.textContent = total.toFixed(2);

    document.querySelectorAll('.remove-from-cart').forEach(btn => {
      btn.onclick = () => {
        delete window.cart[btn.dataset.id];
        localStorage.setItem('cart', JSON.stringify(window.cart));
        updateCartTotal();
      };
    });
  };

  // CART ICON
  const cartIcon = document.getElementById('cartIcon');
  const cartPanel = document.getElementById('cartPanel');
  const closeCart = document.getElementById('closeCart');

  if (cartIcon && cartPanel) {
    cartIcon.style.display = 'flex';
    cartIcon.onclick = () => {
      cartPanel.classList.toggle('active');
      if (cartPanel.classList.contains('active')) {
        updateCartTotal();
        initializePayPalButton();
      }
    };
    if (closeCart) closeCart.onclick = () => cartPanel.classList.remove('active');
  }

  // ADD TO CART
  window.addToCart = function (id) {
    const p = window.products.find(x => x.id === id);
    if (!p) return;
    if (!window.cart[id]) window.cart[id] = { title: p.title, price: p.price, quantity: 0 };
    window.cart[id].quantity++;
    localStorage.setItem('cart', JSON.stringify(window.cart));
    updateCartTotal();
    alert('Added to cart!');
  };

  // PAYPAL BUTTON
  window.initializePayPalButton = function () {
    if (isPayPalInitialized || !window.paypal) return;
    const container = document.getElementById('cartPaypalButton');
    if (!container) return;

    container.innerHTML = '';
    isPayPalInitialized = true;

    paypal.Buttons({
      style: {
        layout: 'vertical',
        color: 'gold',
        shape: 'rect',
        label: 'paypal'
      },
      createOrder: (data, actions) => {
        if (!document.getElementById('termsCheckbox')?.checked) {
          alert('Please agree to the Terms and Conditions.');
          return;
        }
        const total = document.getElementById('cartTotal')?.textContent || '0';
        const value = (parseFloat(total) / exchangeRate).toFixed(2);
        return actions.order.create({
          purchase_units: [{ amount: { value, currency_code: 'USD' } }]
        });
      },
      onApprove: (data, actions) => {
        return actions.order.capture().then(() => {
          const orderData = {
            name: document.getElementById('name')?.value || '',
            phone: document.getElementById('phone')?.value || '',
            address: document.getElementById('address')?.value || '',
            paymentMethod: 'paypal',
            cart: window.cart
          };
          axios.post('/create-order', orderData)
            .then(r => {
              if (r.data.success) {
                alert(`Order placed! Order ID: ${r.data.orderId}`);
                window.cart = {};
                localStorage.setItem('cart', '{}');
                updateCartTotal();
                cartPanel?.classList.remove('active');
                document.getElementById('checkoutForm')?.reset();
              } else {
                alert('Order failed');
              }
            })
            .catch(() => alert('Payment failed'));
        });
      },
      onError: () => {
        container.innerHTML = '<p>PayPal unavailable. Use Cash on Delivery.</p>';
      }
    }).render('#cartPaypalButton');
  };

  // CHECKOUT FORM — FIXED: preventDefault() + COD + PayPal handling
  const checkoutForm = document.getElementById('checkoutForm');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault(); // ← STOPS PAGE RELOAD

      const name = document.getElementById('name').value.trim();
      const phone = document.getElementById('phone').value.trim();
      const address = document.getElementById('address').value.trim();
      const paymentMethod = document.getElementById('paymentMethod').value;
      const termsChecked = document.getElementById('termsCheckbox').checked;

      if (!name || !phone || !address) {
        alert('Please fill in all fields');
        return;
      }
      if (!termsChecked) {
        alert('Please agree to the Terms and Conditions');
        return;
      }
      if (Object.keys(window.cart).length === 0) {
        alert('Your cart is empty');
        return;
      }

      const orderData = {
        name,
        phone,
        address,
        paymentMethod,
        cart: window.cart
      };

      try {
        const res = await axios.post('/create-order', orderData);
        if (res.data.success) {
          alert(`Order placed successfully!\nOrder ID: ${res.data.orderId}\n\nSave this ID to track your order.`);
          window.cart = {};
          localStorage.setItem('cart', JSON.stringify({}));
          updateCartTotal();
          checkoutForm.reset();
          cartPanel?.classList.remove('active');
        } else {
          alert('Order failed: ' + (res.data.error || 'Unknown error'));
        }
      } catch (err) {
        alert('Failed to place order. Please try again.');
        console.error(err);
      }
    });
  }

  // TRACK ORDER
  const trackForm = document.getElementById('trackOrderForm');
  if (trackForm) {
    trackForm.addEventListener('submit', async e => {
      e.preventDefault();
      const id = document.getElementById('trackOrderId').value.trim();
      const result = document.getElementById('trackResult');
      result.innerHTML = 'Tracking...';
      try {
        const res = await axios.get(`/track-order/${id}`);
        if (res.data.success) {
          const o = res.data.order;
          result.innerHTML = `
            <p>Order ID: ${o.orderId}</p>
            <p>Status: ${o.status}</p>
            <p>Items: ${Object.values(o.cart).map(i => `${i.title} (x${i.quantity})`).join(', ')}</p>
          `;
        } else {
          result.innerHTML = '<p>Not found</p>';
        }
      } catch {
        result.innerHTML = '<p>Error</p>';
      }
    });
  }

  updateCartTotal();
});