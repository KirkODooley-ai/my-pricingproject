import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    user: process.env.PGUSER || 'postgres',
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE || 'pricing_test',
    password: process.env.PGPASSWORD, // User MUST provide this in env
    port: process.env.PGPORT || 3006,
});

// Product Matchers (Name -> Gauges Needed)
const MISSING_VARIANTS = [
    { name: 'FC36', gauges: [26, 29] },
    { name: 'I9', gauges: [24, 26, 29] },
    { name: 'II6', gauges: [26, 29] },
    { name: 'FR', gauges: [26, 29] },
    { name: 'FA', gauges: [24, 26] },
    { name: 'Forma Loc 12"', gauges: [26, 29] },
    { name: 'Forma Loc 16"', gauges: [26, 29] }
];

async function fixVariants() {
    const client = await pool.connect();
    try {
        console.log("Starting Variant Fix...");

        for (const item of MISSING_VARIANTS) {
            // Find Product ID
            // Using ILIKE for fuzzy but specific match
            const res = await client.query('SELECT id, name FROM products WHERE name ILIKE $1 LIMIT 1', [`%${item.name} Panel%`]);

            if (res.rows.length === 0) {
                // Try simpler match if 'Panel' fails
                const res2 = await client.query('SELECT id, name FROM products WHERE name ILIKE $1 LIMIT 1', [`%${item.name}%`]);
                if (res2.rows.length === 0) {
                    console.warn(`Could not find product matching: ${item.name}`);
                    continue;
                }
                res.rows[0] = res2.rows[0];
            }

            const product = res.rows[0];
            console.log(`Processing Product: ${product.name} (ID: ${product.id})`);

            for (const gauge of item.gauges) {
                // Check if exists
                const check = await client.query(
                    'SELECT 1 FROM product_variants WHERE product_id = $1 AND gauge = $2',
                    [product.id, gauge]
                );

                if (check.rows.length === 0) {
                    console.log(`  -> Inserting Missing Variant: ${gauge} Gauge`);
                    // Determine weight (rough defaults if unknown, or NULL)
                    // 29Ga ~ 2.0 lbs/ft, 26Ga ~ 2.7, 24Ga ~ 3.4
                    let weight = 0;
                    if (gauge === 29) weight = 2.0;
                    if (gauge === 26) weight = 2.7;
                    if (gauge === 24) weight = 3.4;

                    await client.query(
                        'INSERT INTO product_variants (product_id, gauge, weight_lbs_ft, is_active) VALUES ($1, $2, $3, TRUE)',
                        [product.id, gauge, weight]
                    );
                } else {
                    console.log(`  -> Variant ${gauge} Gauge already exists.`);
                }
            }
        }

        console.log("Fix Complete.");

    } catch (e) {
        console.error("Error:", e);
    } finally {
        client.release();
        await pool.end();
    }
}

fixVariants();
