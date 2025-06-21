import { addToCart } from './products.js';

console.log('script.js loaded');

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded, addToCart is available:', typeof addToCart === 'function');

  const buttons = document.querySelectorAll('button[data-product-id]');
  console.log('Found buttons:', buttons.length);
  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const productId = button.getAttribute('data-product-id');
      console.log('Button clicked, calling addToCart with productId:', productId);
      addToCart(productId);
    });
  });
});