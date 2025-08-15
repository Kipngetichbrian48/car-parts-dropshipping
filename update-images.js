import { readFile, writeFile, copyFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Define paths
const productsPath = join(__dirname, 'public', 'data', 'products.json');
const backupPath = join(__dirname, 'public', 'data', 'products-backup.json');

// Function to check if a URL is likely an AliExpress image URL
const isAliExpressUrl = (url) => {
    try {
        return url.includes('aliexpress-media.com') && url.match(/\.(jpg|jpeg|png|avif|webp)$/i);
    } catch {
        return false;
    }
};

// Function to convert low-resolution URL to high-resolution
const toHighResUrl = (url) => {
    // Handle various low-res suffixes and formats
    const patterns = [
        /_(\d+x\d+)(q\d+)?\.jpg_\.avif/,
        /_(\d+x\d+)(q\d+)?\.jpg/,
        /_(\d+x\d+)(q\d+)?\.webp/,
        /\.jpg_\.avif/,
        /\.jpg/,
        /\.webp/,
        /\.avif/
    ];

    // Try replacing with 960x960.jpg
    let highResUrl = url;
    for (const pattern of patterns) {
        if (url.match(pattern)) {
            highResUrl = url.replace(pattern, '_960x960.jpg');
            break;
        }
    }

    // If no pattern matched, append _960x960.jpg before the extension
    if (highResUrl === url && isAliExpressUrl(url)) {
        highResUrl = url.replace(/\.(jpg|jpeg|png|avif|webp)$/, '_960x960.$1');
    }

    return highResUrl;
};

// Main function to update products.json
async function updateImageUrls() {
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

        // Update image URLs
        const updatedProducts = products.map((product, index) => {
            if (!product.images || !Array.isArray(product.images) || product.images.length !== 3) {
                console.warn(`Product ${product.id || index}: Invalid images array`, product.images);
                return {
                    ...product,
                    images: product.images && Array.isArray(product.images)
                        ? product.images.map(img => (isAliExpressUrl(img) ? toHighResUrl(img) : img))
                        : ['https://via.placeholder.com/150', 'https://via.placeholder.com/60', 'https://via.placeholder.com/60']
                };
            }

            const updatedImages = product.images.map((img, imgIndex) => {
                if (isAliExpressUrl(img)) {
                    const highResUrl = toHighResUrl(img);
                    console.log(`Product ${product.id || index}, Image ${imgIndex + 1}: ${img} -> ${highResUrl}`);
                    return highResUrl;
                }
                console.warn(`Product ${product.id || index}, Image ${imgIndex + 1}: Non-AliExpress URL, unchanged: ${img}`);
                return img;
            });

            return { ...product, images: updatedImages };
        });

        // Write updated products.json
        await writeFile(productsPath, JSON.stringify(updatedProducts, null, 2));
        console.log('Updated products.json with high-resolution image URLs');

        // Log sample URLs for manual verification
        console.log('Sample updated products for verification:');
        updatedProducts.slice(0, 5).forEach(product => {
            console.log(`Product ${product.id}:`, product.images);
        });
        console.log('Please verify 5–10 URLs in a browser to ensure they load high-resolution images.');

    } catch (error) {
        console.error('Error updating products.json:', error.message);
        console.log('Restore from backup if needed:', backupPath);
    }
}

// Run the script
updateImageUrls();