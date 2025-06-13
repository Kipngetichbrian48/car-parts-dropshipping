async function fetchProducts() {
    try {
        const response = await fetch('/data/products.json');
        const products = await response.json();
        // Add a default price since it's not in CSV
        return products.map(product => ({
            ...product,
            price: 29.99 // Default price; adjust as needed
        }));
    } catch (error) {
        console.error('Error fetching products:', error);
        return [];
    }
}
export { fetchProducts };