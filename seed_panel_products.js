import { query } from './server/db.js';
import dotenv from 'dotenv';
dotenv.config();

// Current cost prices per linear foot. List price = cost x 2.
const VARIANTS = [
  { name: 'AZ50 (Algalume) 29ga gr80',    cost: 3.42 },
  { name: 'G90 (Galvanized) 29ga gr80',    cost: 3.42 },
  { name: 'Bright White Liner 29ga gr80',  cost: 3.72 },
  { name: 'Colour 40yr 29ga gr80',         cost: 3.89 },
  { name: 'AZ50 (Algalume) 26ga gr80',    cost: 4.27 },
  { name: 'G90 (Galvanized) 26ga gr80',   cost: 4.43 },
  { name: 'WhWh or BrWh Liner 26ga gr80', cost: 4.43 },
  { name: 'Colour 40yr 26ga gr80',         cost: 4.91 },
];

// Try multiple spellings in case the category was entered differently
const PANEL_CATEGORIES = [
  { display: 'FC36',          lookups: ['FC36'] },
  { display: 'II6',           lookups: ['II6', 'II/6'] },
  { display: 'I9',            lookups: ['I9', 'I/9'] },
  { display: 'II6 Reverse',   lookups: ['FR', 'II6 Reverse', 'II/6 Reverse'] },
];

async function seedPanelProducts() {
  let inserted = 0;
  let skipped = 0;

  for (const cat of PANEL_CATEGORIES) {
    let categoryId = null;
    let foundName = null;

    for (const name of cat.lookups) {
      const res = await query('SELECT id, name FROM categories WHERE name = $1', [name]);
      if (res.rows.length > 0) {
        categoryId = res.rows[0].id;
        foundName = res.rows[0].name;
        break;
      }
    }

    if (!categoryId) {
      console.warn(`Panel seed: category "${cat.display}" not found (tried: ${cat.lookups.join(', ')}) — skipping`);
      continue;
    }

    for (const v of VARIANTS) {
      const productName = `${foundName} ${v.name}`;
      const cost = v.cost;
      const price = +(cost * 2).toFixed(2);

      const existing = await query(
        'SELECT id FROM products WHERE name = $1 AND category_id = $2',
        [productName, categoryId]
      );

      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }

      await query(
        `INSERT INTO products (id, name, cost, price, category_id, sell_unit)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
        [productName, cost, price, categoryId, 'lft']
      );

      console.log(`Panel seed: added ${productName} — cost $${cost}/lft, list $${price}/lft`);
      inserted++;
    }
  }

  if (inserted > 0 || skipped === 0) {
    console.log(`Panel seed complete: ${inserted} added, ${skipped} already existed.`);
  }
}

seedPanelProducts().catch(e => {
  console.error('Panel seed failed:', e.message);
}).finally(() => process.exit(0));
