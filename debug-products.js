import { query } from './server/db.js';

async function debugProducts() {
    try {
        console.log("Querying products for FC36, I9, etc...");
        const res = await query(`
            SELECT id, name, description, category_id, sub_category 
            FROM products 
            WHERE name ILIKE '%FC36%' OR name ILIKE '%I9%' OR name ILIKE '%Forma Loc%'
        `);
        console.log("Found products:", res.rows);
    } catch (e) {
        console.error("Error:", e);
    }
}

debugProducts();
