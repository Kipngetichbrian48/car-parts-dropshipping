// scripts/standardize-categories.js
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function standardizeCategories() {
  try {
    // Read products.json
    const productsPath = join(__dirname, '../public/data/products.json');
    const productsData = await readFile(productsPath, 'utf8');
    let products = JSON.parse(productsData);

    // Define valid categories
    const validCategories = [
      'Oil Filters',
      'Air Filters',
      'Brake Parts',
      'Dash Cams',
      'Air Intake Systems',
      'Fuel Tank Accessories',
      'Air Suspension',
      'Bonnet Spring',
      'Coilover Suspension',
      'Alloy Wheels',
      'Drive Shafts',
      'Transmission Components',
      'Gear Shift Knobs',
      'Car Seat Covers',
      'Jump Starter Cables',
      'Heads-Up Displays'
    ];

    // Standardize categories
    products = products.map(product => {
      let category = product.category || 'Uncategorized';
      // Fix known typos and case sensitivity
      category = category
        .replace('Coilover Suspunsion', 'Coilover Suspension')
        .replace('Brake parts', 'Brake Parts')
        .replace('Heads-UP Dispays', 'Heads-Up Displays')
        .replace('Seat Covers', 'Car Seat Covers')
        .replace('Jump Starters', 'Jump Starter Cables')
        .trim();

      // Ensure category is valid
      if (!validCategories.includes(category)) {
        console.warn(`Product ${product.id}: Invalid category '${category}', setting to 'Uncategorized'`);
        category = 'Uncategorized';
      }

      return { ...product, category };
    });

    // Write updated products.json
    await writeFile(productsPath, JSON.stringify(products, null, 2));
    console.log('Categories standardized in products.json');

    // Log unique categories
    const uniqueCategories = [...new Set(products.map(p => p.category))].sort();
    console.log('Unique categories found:', uniqueCategories);
  } catch (error) {
    console.error('Error standardizing categories:', error);
  }
}

standardizeCategories();