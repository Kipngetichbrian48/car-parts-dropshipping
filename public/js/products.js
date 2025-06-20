// Export the addToCart function
export function addToCart(productId) {
  console.log('Added to cart:', productId);
  // Add your cart logic here (e.g., update cart UI, store in localStorage)
  const cartItems = document.getElementById('cartItems');
  const li = document.createElement('li');
  li.textContent = `Product ID: ${productId} - $0.00`; // Adjust price logic as needed
  cartItems.appendChild(li);
  updateCartTotal();
}

// Example helper function (optional)
function updateCartTotal() {
  const cartTotal = document.getElementById('cartTotal');
  cartTotal.textContent = '10.00'; // Replace with dynamic total calculation
}