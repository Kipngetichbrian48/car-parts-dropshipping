console.log('products.js loaded');

window.addToCart = function(productId) {
    const product = window.products.find(p => p.id === productId);
    if (!product) {
        console.error('Product not found for ID:', productId);
        return;
    }
    if (!window.cart[productId]) {
        window.cart[productId] = { ...product, quantity: 0 };
    }
    window.cart[productId].quantity += 1;
    localStorage.setItem('cart', JSON.stringify(window.cart));
    updateCartItems();
    window.dispatchEvent(new Event('cartUpdated'));
};

window.updateCartTotal = function() {
    const cartItems = document.getElementById('cartItems');
    if (!cartItems) return;
    let total = 0;
    cartItems.innerHTML = '';
    for (const productId in window.cart) {
        const item = window.cart[productId];
        total += item.price * item.quantity;
        const li = document.createElement('li');
        li.innerHTML = `
            ${item.title} - $${item.price} x ${item.quantity}
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
            updateCartItems();
            window.dispatchEvent(new Event('cartUpdated'));
        });
    });
};

function updateCartItems() {
    const cartItems = document.getElementById('cartItems');
    if (!cartItems) return;
    cartItems.innerHTML = '';
    for (const productId in window.cart) {
        const item = window.cart[productId];
        const li = document.createElement('li');
        li.innerHTML = `
            ${item.title} - $${item.price} x ${item.quantity}
            <button class="remove-from-cart" data-product-id="${productId}">Remove</button>
        `;
        cartItems.appendChild(li);
    }
    document.querySelectorAll('.remove-from-cart').forEach(button => {
        button.addEventListener('click', (e) => {
            const productId = e.currentTarget.getAttribute('data-product-id');
            delete window.cart[productId];
            localStorage.setItem('cart', JSON.stringify(window.cart));
            updateCartItems();
            window.dispatchEvent(new Event('cartUpdated'));
        });
    });
}