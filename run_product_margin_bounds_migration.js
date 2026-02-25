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
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
    user: process.env.PGUSER || undefined,
    host: process.env.PGHOST || undefined,
    database: process.env.PGDATABASE || undefined,
    password: process.env.PGPASSWORD || undefined,
    port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
});

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, 'migrations', 'product_margin_bounds.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Running migration: product_margin_bounds.sql');
        await pool.query(sql);
        console.log('✅ Migration successful: margin_floor / margin_ceiling added to products.');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        await pool.end();
    }
}

runMigration();

