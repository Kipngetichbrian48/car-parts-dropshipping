// Define cart as a global variable
window.cart = window.cart || {};
// Export the addToCart function
export function addToCart(productId) {
  console.log('addToCart called with productId:', productId);
    // Check if window.products is defined
  if (!window.products || !Array.isArray(window.products)) {
    console.error('window.products is undefined or not an array:', window.products);
    return;
  }
  console.log('window.products available:', window.products.length);
   // Find the product in window.products
  const product = window.products.find(p => p.id === productId);
  if (!product) {
    console.error('Product not found with id:', productId);
    return;
  }
  console.log('Found product:', product);

  // Update cart state
  window.cart[productId] = (cart[productId] || 0) + 1;
  console.log('Updated cart:', cart);

  // Update cart UI
  const cartItems = document.getElementById('cartItems');
  if (cartItems) {
    console.log('cartItems element found');
    // Clear existing items to avoid duplicates
    cartItems.innerHTML = '';

    // Re-render cart items
    for (let id in cart) {
      const cartProduct = window.products.find(p => p.id === id);
      if (cartProduct) {
        const li = document.createElement('li');
        li.textContent = `${cartProduct.title} x${cart[id]} - $${(cartProduct.price * cart[id]).toFixed(2)}`;
        cartItems.appendChild(li);
      }
    }
    // Dispatch event to update PayPal button
    window.dispatchEvent(new Event('cartUpdated'));
  } else {
    console.error('Cart items element not found');
  }
}

function updateCartTotal() {
  const cartTotal = document.getElementById('cartTotal');
  if (cartTotal) {
    console.log('cartTotal element found');
    const total = Object.keys(cart).reduce((sum, id) => {
      const product = window.products.find(p => p.id === id);
      return sum + (product ? product.price * cart[id] : 0);
    }, 0);
    cartTotal.textContent = total.toFixed(2);
  } else {
    console.error('Cart total element not found');
  }
}