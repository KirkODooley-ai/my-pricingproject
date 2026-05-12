import { query } from './server/db.js';
import dotenv from 'dotenv';
dotenv.config();

// Full category list in display order
const ALL_CATEGORIES = [
    // Rolled Product — main profiles
    'FC36', 'FR', 'FR Reverse', 'II6', 'FA', 'I9',
    // Rolled Product — Corrugated
    '32 7/8" Corrugated', '37 7/8 Corrugated',
    // Rolled Product — Mechanical / Clip Loc
    '1" Mechanical Loc 13.125"', '1" Mechanical Loc 16"',
    '1 1/2" Mechanical Loc 12.125"', '1 1/2" Mechanical Loc 16"',
    '2" Mechanical Loc',
    '1 1/2" Clip Loc 7.375"', '1 1/2" Clip Loc 11.375"', '1 1/2" Clip Loc 16"',
    // Rolled Product — Nail Strip
    '1" Nail Strip 11 3/4"', '1" Nail Strip 16"', '1" Nail Strip 17 1/2"', '1" Nail Strip 18"',
    '1 1/2" Nail Strip 12 1/8"', '1 1/2" Nail Strip 16"',
    // Rolled Product — Inter Loc
    '7 1/2" Inter Loc', '8" Inter Loc', '12" Interloc',
    // Rolled Product — Forma Loc
    '12" Forma Loc', '16" Forma Loc', '17" Forma Loc',
    // Rolled Product — Forma Batten
    '10" Forma Batten', '12 3/8" Forma Batten',
    // Cladding
    '13 1/2" Board & Batten', '9 1/2" Board & Batten', 'Expand Modular', 'ShipLap',
    '5.2" Box Rib', '6" Box Rib', '6" Box Rib Reverse', '7.2 " Box Rib',
    '6 1/4" Forma Plank', '8 1/2" Forma Plank', '5.625" Slimline', '7.125" Slimline Wide', '6" Shiplap',
    // Accessories
    'Clips', 'Closures', 'Coils', 'Cupolas', 'Fasteners', 'Flats', 'Gutters',
    'Hand Tools', 'Misc', 'Packaging', 'Paint', 'Plumbing Flashing', 'Polycarbonate',
    'Sealants', 'Sliding Doors', 'Snow Guards', 'Steel Shingles', 'Structural',
    'Underlay', 'Walk Door'
];

async function seedCategories() {
    let inserted = 0;
    let skipped = 0;

    // One-time rename: 9 3/4" was always meant to be 9 1/2"
    await query(`UPDATE categories SET name = '9 1/2" Board & Batten' WHERE name = '9 3/4" Board & Batten'`);
    // One-time rename: 7 1/5" was incorrectly entered, correct is 7 1/2"
    await query(`UPDATE categories SET name = '7 1/2" Inter Loc' WHERE name = '7 1/5" Inter Loc'`);
    // Disambiguate Clip Loc by coverage — existing one is the 7.375" coverage
    await query(`UPDATE categories SET name = '1 1/2" Clip Loc 7.375"' WHERE name = '1 1/2" Clip Loc'`);
    // Disambiguate Mechanical Loc by coverage
    await query(`UPDATE categories SET name = '1" Mechanical Loc 13.125"' WHERE name = '1" Mechanical Loc'`);
    await query(`UPDATE categories SET name = '1 1/2" Mechanical Loc 12.125"' WHERE name = '1 1/2" Mechanical Loc'`);

    for (let i = 0; i < ALL_CATEGORIES.length; i++) {
        const name = ALL_CATEGORIES[i];
        // Use the name as the ID so it's stable and idempotent
        const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');

        const existing = await query('SELECT id FROM categories WHERE name = $1', [name]);

        if (existing.rows.length > 0) {
            skipped++;
            continue;
        }

        try {
            await query(
                `INSERT INTO categories (id, name, revenue, material_cost) VALUES ($1, $2, 0, 0)`,
                [id, name]
            );
            console.log(`Category seed: added "${name}"`);
            inserted++;
        } catch (e) {
            // ID collision — try with a uuid-style suffix
            try {
                await query(
                    `INSERT INTO categories (id, name, revenue, material_cost) VALUES (gen_random_uuid()::text, $1, 0, 0)`,
                    [name]
                );
                console.log(`Category seed: added "${name}" (fallback id)`);
                inserted++;
            } catch (e2) {
                console.warn(`Category seed: could not insert "${name}": ${e2.message}`);
            }
        }
    }

    console.log(`Category seed complete: ${inserted} added, ${skipped} already existed.`);
}

seedCategories().catch(e => {
    console.error('Category seed failed:', e.message);
}).finally(() => process.exit(0));
