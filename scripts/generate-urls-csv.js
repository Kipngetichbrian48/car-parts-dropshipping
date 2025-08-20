// scripts/generate-urls-csv.js
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generateUrlsCsv() {
  try {
    const productsPath = join(__dirname, '../public/data/products.json');
    const productsData = await readFile(productsPath, 'utf8');
    const products = JSON.parse(productsData);
    const csv = ['url', ...products.map(p => p.url)].join('\n');
    await writeFile(join(__dirname, '../aliexpress_products.csv'), csv);
    console.log('Generated aliexpress_products.csv with 90 URLs');
  } catch (error) {
    console.error('Error generating CSV:', error);
  }
}

generateUrlsCsv();