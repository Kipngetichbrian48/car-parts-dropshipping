// Export the addToCart function
export function addToCart(productId) {
  console.log('Added to cart:', productId);
  // Example cart logic
  const cartItems = document.getElementById('cartItems');
  if (cartItems) {
    const li = document.createElement('li');
    li.textContent = `Product ID: ${productId} - $0.00`; // Adjust price logic as needed
    cartItems.appendChild(li);
    updateCartTotal();
  } else {
    console.error('Cart items element not found');
  }
}

// Helper function (not exported, for internal use)
function updateCartTotal() {
  const cartTotal = document.getElementById('cartTotal');
  if (cartTotal) {
    cartTotal.textContent = '10.00'; // Replace with dynamic total calculation
  } else {
    console.error('Cart total element not found');
  }
}