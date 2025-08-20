import { readFile, writeFile, copyFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Define paths
const productsPath = join(__dirname, 'public', 'data', 'products.json');
const backupPath = join(__dirname, 'public', 'data', 'products-backup.json');

// Number of additional images to add per product
const additionalImages = 2; // Change to 1 if only adding one extra image

// Placeholder URL for new images (to be manually replaced)
const placeholderUrl = 'https://via.placeholder.com/960x960';

// Function to check if a URL is valid
const isValidUrl = (url) => {
    try {
        new URL(url);
        return url.match(/\.(jpg|jpeg|png|avif|webp)$/i);
    } catch {
        return false;
    }
};

// Main function to add images
async function addImagesToProducts() {
    try {
        // Backup original file
        if (await readFile(productsPath).catch(() => false)) {
            await copyFile(productsPath, backupPath);
            console.log('Backup created at:', backupPath);
        } else {
            throw new Error('products.json not found at: ' + productsPath);
        }

        // Read products.json
        const productsData = await readFile(productsPath, 'utf8');
        const products = JSON.parse(productsData);

        // Validate product count
        if (products.length !== 90) {
            console.warn(`Expected 90 products, found ${products.length}`);
        }

        // Add images to each product
        const updatedProducts = products.map((product, index) => {
            if (!product.images || !Array.isArray(product.images) || product.images.length !== 3) {
                console.warn(`Product ${product.id || index}: Invalid images array`, product.images);
                return {
                    ...product,
                    images: product.images && Array.isArray(product.images)
                        ? [...product.images, ...Array(additionalImages).fill(placeholderUrl)]
                        : Array(3 + additionalImages).fill(placeholderUrl)
                };
            }

            const newImages = [...product.images, ...Array(additionalImages).fill(placeholderUrl)];
            console.log(`Product ${product.id || index}: Added ${additionalImages} images. New images:`, newImages);
            return { ...product, images: newImages };
        });

        // Write updated products.json
        await writeFile(productsPath, JSON.stringify(updatedProducts, null, 2));
        console.log(`Updated products.json with ${additionalImages} additional images per product`);

        // Log sample products for verification
        console.log('Sample updated products for verification:');
        updatedProducts.slice(0, 5).forEach(product => {
            console.log(`Product ${product.id}:`, product.images);
        });
        console.log('Please replace placeholder URLs (https://via.placeholder.com/960x960) with high-resolution AliExpress URLs.');

    } catch (error) {
        console.error('Error updating products.json:', error.message);
        console.log('Restore from backup if needed:', backupPath);
    }
}

// Run the script
addImagesToProducts();