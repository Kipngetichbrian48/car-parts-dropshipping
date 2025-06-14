// public/js/products.js
export async function fetchProducts() {
    try {
        const response = await fetch('/data/products.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Fetched products:', data); // Debug log to verify data
        return data; // Returns array of products with id, title, image, price
    } catch (error) {
        console.error('Error fetching products:', error);
        return []; // Return empty array on failure to avoid breaking the app
    }
}