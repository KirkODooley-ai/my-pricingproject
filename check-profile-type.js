
import pg from 'pg';
const { Pool, types } = pg;
types.setTypeParser(1700, (val) => parseFloat(val));
const pool = new Pool({
    user: process.env.PGUSER || 'postgres',
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE || 'pricing_test',
    password: process.env.PGPASSWORD || 'password',
    port: process.env.PGPORT || 3006,
});

async function run() {
    try {
        const client = await pool.connect();

        console.log("Checking Categories...");
        const cats = await client.query("SELECT * FROM categories WHERE name ILIKE '%FC36%' OR name ILIKE '%FR%'");
        console.table(cats.rows);

        console.log("\nChecking Products...");
        const prods = await client.query("SELECT * FROM products WHERE name ILIKE '%FC36%' OR name ILIKE '%FR%'");
        console.table(prods.rows);

        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
