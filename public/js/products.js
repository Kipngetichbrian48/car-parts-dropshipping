// public/js/products.js — STRONG KENYA DETECTION
console.log('products.js loaded');

window.cart = JSON.parse(localStorage.getItem('cart')) || {};
window.products = window.products || [];

let currency = 'USD';
let exchangeRate = 1;

function detectCurrency() {
  try {
    const lang = (navigator.language || navigator.userLanguage || 'en-US').toLowerCase();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';

    // Strong Kenyan detection
    if (
      lang.includes('ke') || 
      lang.startsWith('sw') || 
      lang === 'en-ke' ||
      timeZone.includes('Nairobi') ||
      timeZone.includes('Africa')
    ) {
      currency = 'KES';
      exchangeRate = 130; // Current approximate rate
    } 
    else if (lang.includes('gb') || lang.startsWith('en-gb')) {
      currency = 'GBP';
      exchangeRate = 0.78;
    } 
    else if (lang.startsWith('fr') || lang.startsWith('de') || lang.includes('eu')) {
      currency = 'EUR';
      exchangeRate = 0.92;
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

    console.log(`Currency set to ${currency} (rate: ${exchangeRate}) | Lang: ${lang} | TZ: ${timeZone}`);
  } catch (error) {
    console.error('Currency detection failed, defaulting to USD:', error);
    const priceEl = document.querySelector('.product-price strong');
    if (priceEl) {
      const price = parseFloat(priceEl.dataset.price || priceEl.textContent.replace(/[^0-9.]/g, ''));
      priceEl.textContent = `USD ${price.toFixed(2)}`;
    }
  }
}

// Run it
detectCurrency();