
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
    ssl: { rejectUnauthorized: false },
    max: 1 // Single connection for migration
});

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, 'migrations', 'settings_table.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log("Running migration: settings_table.sql");
        await pool.query(sql);
        console.log("✅ Migration successful: settings table created.");
    } catch (err) {
        console.error("❌ Migration failed:", err);
    } finally {
        await pool.end();
    }
}

runMigration();
