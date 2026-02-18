
import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

const dbConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        port: 5432
    }
    : {
        user: process.env.PGUSER || 'postgres',
        host: process.env.PGHOST || 'localhost',
        database: process.env.PGDATABASE || 'pricing_test',
        password: process.env.PGPASSWORD,
        port: process.env.PGPORT || 3006,
    };

const pool = new Pool(dbConfig);

async function checkAnnualSpend() {
    try {
        const client = await pool.connect();
        console.log("Calculating Total ERP Annual Spend (Targets)...");

        const res = await client.query('SELECT SUM(annual_spend_goal) as total_spend, COUNT(*) as count FROM customers');
        const total = parseFloat(res.rows[0].total_spend);

        console.log(`--------------------------------------------------`);
        console.log(`Total Customers: ${res.rows[0].count}`);
        console.log(`Total Annual Spend (ERP): $${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
        console.log(`--------------------------------------------------`);

        client.release();
    } catch (e) {
        console.error("Error:", e);
    } finally {
        pool.end();
    }
}

checkAnnualSpend();
