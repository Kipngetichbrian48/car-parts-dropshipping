// public/js/products.js — STABLE CURRENCY (NO EXTERNAL API CALLS)
console.log('products.js loaded');

window.cart = JSON.parse(localStorage.getItem('cart')) || {};
window.products = window.products || [];

let currency = 'USD';
let exchangeRate = 1;

// Simple, reliable currency detection using browser language + fallback
function detectCurrency() {
  try {
    const lang = navigator.language || navigator.userLanguage || 'en-US';

    if (lang.startsWith('sw') || lang.includes('KE') || lang === 'en-KE') {
      currency = 'KES';
      exchangeRate = 130; // Approximate rate for KES
    } else if (lang.startsWith('en-GB') || lang.includes('GB')) {
      currency = 'GBP';
      exchangeRate = 0.78;
    } else if (lang.startsWith('de') || lang.startsWith('fr') || lang.includes('EU')) {
      currency = 'EUR';
      exchangeRate = 0.92;
    }
    // Default remains USD for most users

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

    console.log(`Currency set to ${currency} (rate: ${exchangeRate}) based on browser language`);
  } catch (error) {
    console.error('Currency detection failed, defaulting to USD:', error);
  }
}

// Run it
detectCurrency();