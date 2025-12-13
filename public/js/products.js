// public/js/products.js — FIXED & MINIMAL (only currency for product page)
console.log('products.js loaded');

window.cart = JSON.parse(localStorage.getItem('cart')) || {};
window.products = window.products || [];

let currency = 'USD';
let exchangeRate = 1;

// CURRENCY DETECTION — RUNS ON EVERY PAGE
async function detectCurrency() {
  try {
    const res = await axios.get('https://ipapi.co/json/');
    const code = res.data.country_code;
    const map = { 'KE': 'KES', 'US': 'USD', 'GB': 'GBP', 'EU': 'EUR' };
    currency = map[code] || 'USD';

    if (currency !== 'USD') {
      const rateRes = await axios.get('/api/exchange-rate', { params: { currency } });
      exchangeRate = rateRes.data.rate || 1;
    }

    // Update product page price
    const priceEl = document.querySelector('.product-price strong');
    if (priceEl) {
      const price = parseFloat(priceEl.dataset.price || priceEl.textContent.replace(/[^0-9.]/g, ''));
      priceEl.textContent = `${currency} ${(price * exchangeRate).toFixed(2)}`;
    }

    // Update cart if function exists
    if (typeof window.updateCartTotal === 'function') {
      window.updateCartTotal();
    }
  } catch (error) {
    console.error('Currency detection failed:', error);
  }
}

// Run it
detectCurrency();