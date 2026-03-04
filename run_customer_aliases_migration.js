import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
    max: 1
});

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, 'migrations', 'add_customer_aliases_unique.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Running migration: add_customer_aliases_unique.sql');
        await pool.query(sql);
        console.log('✅ Migration successful: alias_name unique index added for variance report linking.');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
