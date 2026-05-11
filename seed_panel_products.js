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

  // Slimline panels — each width has its own prices
  const SLIMLINE_CATEGORIES = [
    {
      display: '5.625" Slimline',
      lookups: ['5.625" Slimline'],
      variants: [
        { name: 'AZ50 (Algalume) 24ga',   retail: 1.96 },
        { name: 'Colour / Textured 24ga',  retail: 2.16 },
        { name: 'Image Series 24ga',        retail: 2.58 },
        { name: 'Weathering Steel 22ga',    retail: 2.53 },
      ]
    },
    {
      display: '7.125" Slimline Wide',
      lookups: ['7.125" Slimline Wide'],
      variants: [
        { name: 'AZ50 (Algalume) 24ga',   retail: 2.26 },
        { name: 'Colour / Textured 24ga',  retail: 2.42 },
        { name: 'Image Series 24ga',        retail: 2.94 },
        { name: 'Weathering Steel 22ga',    retail: 2.87 },
      ]
    },
  ];

  for (const cat of SLIMLINE_CATEGORIES) {
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
      console.warn(`Slimline seed: category "${cat.display}" not found — skipping`);
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
        console.log(`Slimline seed: updated ${productName} — cost $${cost}/lft, retail list $${price}/lft`);
        skipped++;
        continue;
      }

      await query(
        `INSERT INTO products (id, name, cost, price, category_id, sell_unit)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
        [productName, cost, price, categoryId, 'lft']
      );
      console.log(`Slimline seed: added ${productName} — cost $${cost}/lft, retail list $${price}/lft`);
      inserted++;
    }
  }

  // Board & Batten — each width has its own prices
  const BOARD_BATTEN_CATEGORIES = [
    {
      display: '9 1/2" Board & Batten',
      lookups: ['9 1/2" Board & Batten', '9 3/4" Board & Batten'],
      variants: [
        { name: 'AZ50 (Algalume) 24ga',   retail: 2.61 },
        { name: 'Colour/Textured 24ga',    retail: 2.82 },
        { name: 'Image Series 24ga',        retail: 3.47 },
        { name: 'Weathering Steel 22ga',    retail: 3.37 },
      ]
    },
    {
      display: '13 1/2" Board & Batten',
      lookups: ['13 1/2" Board & Batten'],
      variants: [
        { name: 'Textured 24ga',           retail: 3.87 },
        { name: 'Image Series 24ga',        retail: 4.72 },
        { name: 'Weathering Steel 22ga',    retail: 4.62 },
      ]
    },
  ];

  for (const cat of BOARD_BATTEN_CATEGORIES) {
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
      console.warn(`Board & Batten seed: category "${cat.display}" not found — skipping`);
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
        console.log(`B&B seed: updated ${productName} — cost $${cost}/lft, retail list $${price}/lft`);
        skipped++;
        continue;
      }

      await query(
        `INSERT INTO products (id, name, cost, price, category_id, sell_unit)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
        [productName, cost, price, categoryId, 'lft']
      );
      console.log(`B&B seed: added ${productName} — cost $${cost}/lft, retail list $${price}/lft`);
      inserted++;
    }
  }

  // Forma Batten — each width has its own prices
  const FORMA_BATTEN_CATEGORIES = [
    {
      display: '10" Forma Batten',
      lookups: ['10" Forma Batten'],
      variants: [
        { name: 'Colour 26ga', retail: 2.49 },
      ]
    },
    {
      display: '12 3/8" Forma Batten',
      lookups: ['12 3/8" Forma Batten'],
      variants: [
        { name: 'Colour 24ga',       retail: 3.28 },
        { name: 'Textured 24ga',     retail: 3.28 },
        { name: 'Image Series 24ga', retail: 4.18 },
      ]
    },
  ];

  for (const cat of FORMA_BATTEN_CATEGORIES) {
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
      console.warn(`Forma Batten seed: category "${cat.display}" not found — skipping`);
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
        console.log(`Forma Batten seed: updated ${productName} — cost $${cost}/lft, retail list $${price}/lft`);
        skipped++;
        continue;
      }

      await query(
        `INSERT INTO products (id, name, cost, price, category_id, sell_unit)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
        [productName, cost, price, categoryId, 'lft']
      );
      console.log(`Forma Batten seed: added ${productName} — cost $${cost}/lft, retail list $${price}/lft`);
      inserted++;
    }
  }

  // 6" Shiplap
  const SHIPLAP_CATEGORIES = [
    {
      display: '6" Shiplap',
      lookups: ['6" Shiplap', '6" ShipLap'],
      variants: [
        { name: 'AZ50 (Algalume) 24ga',   retail: 2.16 },
        { name: 'Colour / Textured 24ga',  retail: 2.45 },
        { name: 'Image Series 24ga',        retail: 2.58 },
        { name: 'Weathering Steel 22ga',    retail: 3.11 },
      ]
    },
  ];

  for (const cat of SHIPLAP_CATEGORIES) {
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
      console.warn(`Shiplap seed: category "${cat.display}" not found — skipping`);
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
        console.log(`Shiplap seed: updated ${productName} — cost $${cost}/lft, retail list $${price}/lft`);
        skipped++;
        continue;
      }

      await query(
        `INSERT INTO products (id, name, cost, price, category_id, sell_unit)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
        [productName, cost, price, categoryId, 'lft']
      );
      console.log(`Shiplap seed: added ${productName} — cost $${cost}/lft, retail list $${price}/lft`);
      inserted++;
    }
  }

  // Box Rib — all profiles share the same pricing (36" coverage, varies by rib spacing)
  const VARIANTS_BOX_RIB = [
    { name: 'AZ50 (Algalume) 24ga',   retail: 7.44 },
    { name: 'Colour / Textured 24ga',  retail: 8.96 },
    { name: 'Image Series 24ga',        retail: 11.49 },
    { name: 'Weathering Steel 22ga',    retail: 11.27 },
  ];

  const BOX_RIB_CATEGORIES = [
    { display: '5.2" Box Rib',         lookups: ['5.2" Box Rib'] },
    { display: '6" Box Rib',           lookups: ['6" Box Rib'] },
    { display: '6" Box Rib Reverse',   lookups: ['6" Box Rib Reverse'] },
    { display: '7.2" Box Rib',         lookups: ['7.2 " Box Rib', '7.2" Box Rib'] },
  ];

  for (const cat of BOX_RIB_CATEGORIES) {
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
      console.warn(`Box Rib seed: category "${cat.display}" not found — skipping`);
      continue;
    }

    for (const v of VARIANTS_BOX_RIB) {
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
        console.log(`Box Rib seed: updated ${productName} — cost $${cost}/lft, retail list $${price}/lft`);
        skipped++;
        continue;
      }

      await query(
        `INSERT INTO products (id, name, cost, price, category_id, sell_unit)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
        [productName, cost, price, categoryId, 'lft']
      );
      console.log(`Box Rib seed: added ${productName} — cost $${cost}/lft, retail list $${price}/lft`);
      inserted++;
    }
  }

  // Expand Modular Panel — priced per panel
  const EXPAND_MODULAR_CATEGORIES = [
    {
      display: 'Expand Modular',
      lookups: ['Expand Modular'],
      variants: [
        { name: 'Colour / Textured 24ga', retail: 83.25 },
        { name: 'Image Series 24ga',       retail: 94.35 },
      ],
      unit: 'panel'
    },
  ];

  for (const cat of EXPAND_MODULAR_CATEGORIES) {
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
      console.warn(`Expand Modular seed: category "${cat.display}" not found — skipping`);
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
          [cost, price, cat.unit, existing.rows[0].id]
        );
        console.log(`Expand Modular seed: updated ${productName} — cost $${cost}/${cat.unit}, retail list $${price}/${cat.unit}`);
        skipped++;
        continue;
      }

      await query(
        `INSERT INTO products (id, name, cost, price, category_id, sell_unit)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
        [productName, cost, price, categoryId, cat.unit]
      );
      console.log(`Expand Modular seed: added ${productName} — cost $${cost}/${cat.unit}, retail list $${price}/${cat.unit}`);
      inserted++;
    }
  }

  // Inter Loc — 7 1/2" and 8" share the same pricing
  const VARIANTS_INTERLOC = [
    { name: 'AZ50 (Algalume) 24ga',        retail: 2.34 },
    { name: 'SMP Colour / Textured 24ga',   retail: 2.54 },
    { name: 'Image Series 24ga',             retail: 3.18 },
    { name: 'A606 Weathering Steel 22ga',    retail: 3.16 },
  ];

  const INTERLOC_CATEGORIES = [
    { display: '7 1/2" Inter Loc', lookups: ['7 1/2" Inter Loc', '7 1/5" Inter Loc'] },
    { display: '8" Inter Loc',     lookups: ['8" Inter Loc'] },
  ];

  for (const cat of INTERLOC_CATEGORIES) {
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
      console.warn(`Inter Loc seed: category "${cat.display}" not found — skipping`);
      continue;
    }

    for (const v of VARIANTS_INTERLOC) {
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
        console.log(`Inter Loc seed: updated ${productName} — cost $${cost}/lft, retail list $${price}/lft`);
        skipped++;
        continue;
      }

      await query(
        `INSERT INTO products (id, name, cost, price, category_id, sell_unit)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
        [productName, cost, price, categoryId, 'lft']
      );
      console.log(`Inter Loc seed: added ${productName} — cost $${cost}/lft, retail list $${price}/lft`);
      inserted++;
    }
  }

  // 1 1/2" Clip Loc
  const CLIPLOC_CATEGORIES = [
    {
      display: '1 1/2" Clip Loc',
      lookups: ['1 1/2" Clip Loc'],
      variants: [
        { name: 'AZ50 (Algalume) 24ga',      retail: 2.17 },
        { name: 'SMP Colour / Textured 24ga', retail: 2.34 },
        { name: 'Image Series 24ga',           retail: 3.04 },
      ]
    },
  ];

  for (const cat of CLIPLOC_CATEGORIES) {
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
      console.warn(`Clip Loc seed: category "${cat.display}" not found — skipping`);
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
        console.log(`Clip Loc seed: updated ${productName} — cost $${cost}/lft, retail list $${price}/lft`);
        skipped++;
        continue;
      }

      await query(
        `INSERT INTO products (id, name, cost, price, category_id, sell_unit)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
        [productName, cost, price, categoryId, 'lft']
      );
      console.log(`Clip Loc seed: added ${productName} — cost $${cost}/lft, retail list $${price}/lft`);
      inserted++;
    }
  }

  console.log(`Panel seed complete: ${inserted} added, ${skipped} updated.`);
}

seedPanelProducts().catch(e => {
  console.error('Panel seed failed:', e.message);
}).finally(() => process.exit(0));
