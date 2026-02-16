import fs from 'fs-extra';
import path from 'path';

// HARDCODED PATH because we know where it is
const DATA_DIR = "C:\\Users\\kirk.odooley\\Documents\\PricingData";

async function fixData() {
    try {
        console.log(`Scanning data in ${DATA_DIR}...`);

        // 1. Load Categories
        const catPath = path.join(DATA_DIR, 'categories.json');
        const categories = await fs.readJson(catPath);

        console.log(`Original Types count: ${categories.length}`);

        // Dedupe by Name (Case Insensitive)
        const uniqueCats = [];
        const seenNames = new Set();
        const duplicates = [];

        categories.forEach(c => {
            const normalized = c.name.trim();
            if (seenNames.has(normalized.toLowerCase())) {
                duplicates.push(c);
            } else {
                seenNames.add(normalized.toLowerCase());
                // Ensure name is trimmed
                c.name = normalized;
                uniqueCats.push(c);
            }
        });

        console.log(`Fixed Categories count: ${uniqueCats.length}`);
        if (duplicates.length > 0) {
            console.log('Removed duplicates:', duplicates.map(d => d.name));
            await fs.writeJson(catPath, uniqueCats, { spaces: 2 });
            console.log('Saved corrected categories.json');
        } else {
            console.log('No category duplicates found.');
        }

        // 2. Load Products
        const prodPath = path.join(DATA_DIR, 'products.json');
        const products = await fs.readJson(prodPath);

        console.log(`Scanning ${products.length} products...`);
        let changes = 0;

        products.forEach(p => {
            if (p.category) {
                const trimmed = p.category.trim();
                // Fix "Fasteners " -> "Fasteners"
                if (trimmed !== p.category) {
                    p.category = trimmed;
                    changes++;
                }
                // Case fix
                if (trimmed.toLowerCase() === 'fasteners' && p.category !== 'Fasteners') {
                    p.category = 'Fasteners';
                    changes++;
                }
            }
        });

        if (changes > 0) {
            await fs.writeJson(prodPath, products, { spaces: 2 });
            console.log(`Fixed ${changes} products with whitespace/casing issues.`);
        } else {
            console.log('No product issues found.');
        }

    } catch (error) {
        console.error('Error fixing data:', error);
    }
}

fixData();
