import { query } from './server/db.js';
import dotenv from 'dotenv';
dotenv.config();

// Retail list prices per linear foot — already include 40% margin.
// price = retail (as given)
// cost  = retail x 0.60 (backing out the 40% margin)
const VARIANTS = [
  { name: 'AZ50 (Algalume) 29ga gr80',    retail: 3.42 },
  { name: 'G90 (Galvanized) 29ga gr80',    retail: 3.42 },
  { name: 'Bright White Liner 29ga gr80',  retail: 3.72 },
  { name: 'Colour 40yr 29ga gr80',         retail: 3.89 },
  { name: 'AZ50 (Algalume) 26ga gr80',    retail: 4.27 },
  { name: 'G90 (Galvanized) 26ga gr80',   retail: 4.43 },
  { name: 'WhWh or BrWh Liner 26ga gr80', retail: 4.43 },
  { name: 'Colour 40yr 26ga gr80',         retail: 4.91 },
];

// Try multiple spellings in case the category was entered differently
const PANEL_CATEGORIES = [
  { display: 'FC36',          lookups: ['FC36'] },
  { display: 'II6',           lookups: ['II6', 'II/6'] },
  { display: 'I9',            lookups: ['I9', 'I/9'] },
  { display: 'II6 Reverse',   lookups: ['II6 Reverse', 'II/6 Reverse'] },
];

// Roll-formed panels: FR, FR Reverse, FA — 26ga and 24ga only
const VARIANTS_ROLL = [
  { name: 'AZ50 (Algalume) 26ga gr80',    retail: 4.27 },
  { name: 'G90 (Galvanized) 26ga gr80',   retail: 4.43 },
  { name: 'WhWh or BrWh Liner 26ga gr80', retail: 4.43 },
  { name: 'Colour 40yr 26ga gr80',         retail: 4.91 },
  { name: 'AZ50 (Algalume) 24ga gr33',    retail: 6.10 },
  { name: 'Colour 40yr 24ga gr33',         retail: 7.62 },
];

const ROLL_PANEL_CATEGORIES = [
  { display: 'FR',         lookups: ['FR'] },
  { display: 'FR Reverse', lookups: ['FR Reverse'] },
  { display: 'FA',         lookups: ['FA'] },
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
      const cost  = +(v.retail * 0.60).toFixed(4);
      const price = +v.retail.toFixed(4);

      const existing = await query(
        'SELECT id FROM products WHERE name = $1 AND category_id = $2',
        [productName, categoryId]
      );

      if (existing.rows.length > 0) {
        await query(
          `UPDATE products SET cost = $1, price = $2, sell_unit = $3 WHERE id = $4`,
          [cost, price, 'lft', existing.rows[0].id]
        );
        console.log(`Panel seed: updated ${productName} — cost $${cost}/lft, retail list $${price}/lft`);
        skipped++;
        continue;
      }

      await query(
        `INSERT INTO products (id, name, cost, price, category_id, sell_unit)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
        [productName, cost, price, categoryId, 'lft']
      );

      console.log(`Panel seed: added ${productName} — cost $${cost}/lft, retail list $${price}/lft`);
      inserted++;
    }
  }

  // Roll-formed panels (FR, FR Reverse, FA) — 26ga and 24ga variants
  for (const cat of ROLL_PANEL_CATEGORIES) {
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
      console.warn(`Roll panel seed: category "${cat.display}" not found — skipping`);
      continue;
    }

    for (const v of VARIANTS_ROLL) {
      const productName = `${foundName} ${v.name}`;
      const cost  = +(v.retail * 0.60).toFixed(4);
      const price = +v.retail.toFixed(4);

      const existing = await query(
        'SELECT id FROM products WHERE name = $1 AND category_id = $2',
        [productName, categoryId]
      );

      if (existing.rows.length > 0) {
        await query(
          `UPDATE products SET cost = $1, price = $2, sell_unit = $3 WHERE id = $4`,
          [cost, price, 'lft', existing.rows[0].id]
        );
        console.log(`Roll panel seed: updated ${productName} — cost $${cost}/lft, retail list $${price}/lft`);
        skipped++;
        continue;
      }

      await query(
        `INSERT INTO products (id, name, cost, price, category_id, sell_unit)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
        [productName, cost, price, categoryId, 'lft']
      );
      console.log(`Roll panel seed: added ${productName} — cost $${cost}/lft, retail list $${price}/lft`);
      inserted++;
    }
  }

  // FormaLoc panels (12" and 16") — 29ga and 26ga variants
  const VARIANTS_FORMALOC = [
    { name: 'Plain 29ga gr80',   retail: 2.28 },
    { name: 'Colour 29ga gr80',  retail: 2.51 },
    { name: 'Plain 26ga gr80',   retail: 2.79 },
    { name: 'Colour 26ga gr80',  retail: 3.02 },
  ];

  const FORMALOC_CATEGORIES = [
    { display: '12" Forma Loc', lookups: ['12" Forma Loc'] },
    { display: '16" Forma Loc', lookups: ['16" Forma Loc'] },
  ];

  for (const cat of FORMALOC_CATEGORIES) {
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
      console.warn(`FormaLoc seed: category "${cat.display}" not found — skipping`);
      continue;
    }

    for (const v of VARIANTS_FORMALOC) {
      const productName = `${foundName} ${v.name}`;
      const cost  = +(v.retail * 0.60).toFixed(4);
      const price = +v.retail.toFixed(4);

      const existing = await query(
        'SELECT id FROM products WHERE name = $1 AND category_id = $2',
        [productName, categoryId]
      );

      if (existing.rows.length > 0) {
        await query(
          `UPDATE products SET cost = $1, price = $2, sell_unit = $3 WHERE id = $4`,
          [cost, price, 'lft', existing.rows[0].id]
        );
        console.log(`FormaLoc seed: updated ${productName} — cost $${cost}/lft, retail list $${price}/lft`);
        skipped++;
        continue;
      }

      await query(
        `INSERT INTO products (id, name, cost, price, category_id, sell_unit)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
        [productName, cost, price, categoryId, 'lft']
      );
      console.log(`FormaLoc seed: added ${productName} — cost $${cost}/lft, retail list $${price}/lft`);
      inserted++;
    }
  }

  // 32 7/8" Corrugated — 26ga variants
  const VARIANTS_CORR_32 = [
    { name: 'Algalume / Galvanized 26ga gr80', retail: 4.70 },
    { name: 'Colour 26ga gr80',                retail: 5.18 },
  ];

  // 37 7/8 Corrugated — 24ga and 22ga variants
  const VARIANTS_CORR_37 = [
    { name: 'AZ50 (Algalume) 24ga gr33',       retail: 6.10 },
    { name: 'G90 (Galvanized) 24ga gr33',      retail: 6.88 },
    { name: 'Colour/Textured 24ga gr33',        retail: 7.62 },
    { name: 'Image Series PVDF 24ga gr33',      retail: 11.30 },
    { name: 'Weathering Steel 22ga gr33',       retail: 10.15 },
  ];

  const CORRUGATED_CATEGORIES = [
    { display: '32 7/8" Corrugated', lookups: ['32 7/8" Corrugated'], variants: VARIANTS_CORR_32 },
    { display: '37 7/8 Corrugated',  lookups: ['37 7/8 Corrugated'],  variants: VARIANTS_CORR_37 },
  ];

  for (const cat of CORRUGATED_CATEGORIES) {
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
      console.warn(`Corrugated seed: category "${cat.display}" not found — skipping`);
      continue;
    }

    for (const v of cat.variants) {
      const productName = `${foundName} ${v.name}`;
      const cost  = +(v.retail * 0.60).toFixed(4);
      const price = +v.retail.toFixed(4);

      const existing = await query(
        'SELECT id FROM products WHERE name = $1 AND category_id = $2',
        [productName, categoryId]
      );

      if (existing.rows.length > 0) {
        await query(
          `UPDATE products SET cost = $1, price = $2, sell_unit = $3 WHERE id = $4`,
          [cost, price, 'lft', existing.rows[0].id]
        );
        console.log(`Corrugated seed: updated ${productName} — cost $${cost}/lft, retail list $${price}/lft`);
        skipped++;
        continue;
      }

      await query(
        `INSERT INTO products (id, name, cost, price, category_id, sell_unit)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
        [productName, cost, price, categoryId, 'lft']
      );
      console.log(`Corrugated seed: added ${productName} — cost $${cost}/lft, retail list $${price}/lft`);
      inserted++;
    }
  }

  // Forma Plank — each width has its own prices
  const FORMA_PLANK_CATEGORIES = [
    {
      display: '6 1/4" Forma Plank',
      lookups: ['6 1/4" Forma Plank'],
      variants: [
        { name: 'AZ50 (Algalume) 24ga',     retail: 2.28 },
        { name: 'Colour / Textured 24ga',    retail: 2.42 },
        { name: 'Image Series 24ga',          retail: 2.94 },
        { name: 'Weathering Steel 22ga',      retail: 2.88 },
      ]
    },
    {
      display: '8 1/2" Forma Plank',
      lookups: ['8 1/2" Forma Plank'],
      variants: [
        { name: 'AZ50 (Algalume) 24ga',     retail: 2.61 },
        { name: 'Colour / Textured 24ga',    retail: 2.82 },
        { name: 'Image Series 24ga',          retail: 3.47 },
        { name: 'Weathering Steel 22ga',      retail: 3.39 },
      ]
    },
  ];

  for (const cat of FORMA_PLANK_CATEGORIES) {
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
      console.warn(`Forma Plank seed: category "${cat.display}" not found — skipping`);
      continue;
    }

    for (const v of cat.variants) {
      const productName = `${foundName} ${v.name}`;
      const cost  = +(v.retail * 0.60).toFixed(4);
      const price = +v.retail.toFixed(4);

      const existing = await query(
        'SELECT id FROM products WHERE name = $1 AND category_id = $2',
        [productName, categoryId]
      );

      if (existing.rows.length > 0) {
        await query(
          `UPDATE products SET cost = $1, price = $2, sell_unit = $3 WHERE id = $4`,
          [cost, price, 'lft', existing.rows[0].id]
        );
        console.log(`Forma Plank seed: updated ${productName} — cost $${cost}/lft, retail list $${price}/lft`);
        skipped++;
        continue;
      }

      await query(
        `INSERT INTO products (id, name, cost, price, category_id, sell_unit)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
        [productName, cost, price, categoryId, 'lft']
      );
      console.log(`Forma Plank seed: added ${productName} — cost $${cost}/lft, retail list $${price}/lft`);
      inserted++;
    }
  }

  console.log(`Panel seed complete: ${inserted} added, ${skipped} updated.`);
}

seedPanelProducts().catch(e => {
  console.error('Panel seed failed:', e.message);
}).finally(() => process.exit(0));
