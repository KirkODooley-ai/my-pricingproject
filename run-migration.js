
import pg from 'pg';
import fs from 'fs';
import path from 'path';

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
        const sqlPath = path.resolve('migrations/product_variants.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log("Running Migration: product_variants.sql");
        const client = await pool.connect();

        // Split by semicolon? No, migration is one big DO block mostly.
        // Or multiple statements.
        // It has ALTER TABLE, then DO.
        // pg client can execute multiple if simple query.

        await client.query(sql);

        console.log("Migration Success.");
        client.release();
    } catch (e) {
        console.error("Migration Failed:", e);
    } finally {
        await pool.end();
    }
}
run();
