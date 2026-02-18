
import fs from 'fs';
import path from 'path';

const API_URL = 'http://localhost:3001/api/save'; // Port 3001 for backend
const DATA_DIR = 'C:/Users/kirk.odooley/Documents/PricingData';

const files = {
    categories: 'categories.json',
    customers: 'customers.json',
    products: 'products.json',
    salesTransactions: 'salesTransactions.json',
    customerAliases: 'customerAliases.json'
};

// Hardcoded Default Categories from pricingEngine.js
const DEFAULT_CATEGORIES = [
    'FC36', 'FR', 'I9', 'II6', '32 7/8" Corrugated', '37 7/8 Corrugated', 'FA',
    '1 1/2" Mechanical Loc', '1" Nail Strip 11 3/4"', '1" Nail Strip 16"', '1" Nail Strip 17 1/2"',
    '1" Nail Strip 18"', '1 1/2" Clip Loc', '1 1/2" Nail Strip 12 1/8"', '1 1/2" Nail Strip 16"',
    '8" Inter Loc', '12" Interloc', '12" Forma Loc', '16" Forma Loc', '17" Forma Loc',
    '10" Forma Batten', '12 3/8" Forma Batten', '7 1/5" Inter Loc',
    '13 1/2" Board & Batten', '9 3/4" Board & Batten', 'Expand Modular', 'ShipLap',
    '5.2" Box Rib', '6" Box Rib', '6" Box Rib Reverse', '7.2 " Box Rib',
    '6 1/4" Forma Plank', '8 1/2" Forma Plank', '5.625" Slimline', '7.125" Slimline Wide', '6" Shiplap',
    'Clips', 'Closures', 'Coils', 'Cupolas', 'Fasteners', 'Flats', 'Gutters',
    'Hand Tools', 'Misc', 'Packaging', 'Paint', 'Plumbing Flashing', 'Polycarbonate',
    'Sealants', 'Sliding Doors', 'Snow Guards', 'Steel Shingles', 'Structural',
    'Underlay', 'Walk Door'
];

async function postData(type, data) {
    try {
        const response = await fetch(`${API_URL}/${type}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (result.success) {
            console.log(`✅ ${type}: Successfully migrated ${Array.isArray(data) ? data.length : Object.keys(data).length} records.`);
        } else {
            console.error(`❌ ${type}: Failed - ${result.error}`);
        }
    } catch (err) {
        console.error(`❌ ${type}: Error - ${err.message}`);
    }
}

async function migrate() {
    console.log('🚀 Starting Migration to Cloud DB...');

    // Order matters due to foreign keys!
    // 1. Categories (Must exist for Products/Sales)
    // 2. Customers (Must exist for Sales)
    // 3. Products
    // 4. Sales Transactions
    // 5. Aliases
    const order = ['categories', 'customers', 'products', 'salesTransactions', 'customerAliases'];

    for (const type of order) {
        const filePath = path.join(DATA_DIR, files[type]);
        let data = null;

        if (type === 'categories') {
            // Special handling for Categories: Use File OR Defaults
            if (fs.existsSync(filePath)) {
                try {
                    const raw = fs.readFileSync(filePath, 'utf8');
                    if (raw.trim()) {
                        data = JSON.parse(raw);
                        console.log(`Using ${files[type]} from disk.`);
                    }
                } catch (e) {
                    console.warn(`⚠️ Error reading categories.json: ${e.message}`);
                }
            }

            if (!data || data.length === 0) {
                console.log(`ℹ Using Default Categories (local file empty or missing).`);
                data = DEFAULT_CATEGORIES.map((name, idx) => ({
                    id: String(idx + 1),
                    name,
                    revenue: 0,
                    materialCost: 0
                }));
            }
        } else {
            // Standard File Loading
            if (fs.existsSync(filePath)) {
                try {
                    const raw = fs.readFileSync(filePath, 'utf8');
                    if (raw.trim()) {
                        data = JSON.parse(raw);
                        // Handle case where file contains empty array or object
                        if (Array.isArray(data) && data.length === 0) {
                            console.warn(`⚠️ ${files[type]} is empty array. Skipping.`);
                            data = null;
                        } else if (Object.keys(data).length === 0) {
                            console.warn(`⚠️ ${files[type]} is empty object. Skipping.`);
                            data = null;
                        }
                    } else {
                        console.warn(`⚠️ ${files[type]} is empty text. Skipping.`);
                    }
                } catch (e) {
                    console.warn(`⚠️ Error parsing ${files[type]}: ${e.message}`);
                }
            } else {
                console.warn(`⚠️ ${files[type]} not found. Skipping.`);
            }
        }

        if (data) {
            console.log(`Migrating ${type} (${Array.isArray(data) ? data.length : Object.keys(data).length} records)...`);
            await postData(type, data);
        }
    }
    console.log('✨ Migration Complete.');
}

migrate();
