
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

async function checkSum() {
    try {
        const client = await pool.connect();
        console.log("Calculating Total Sales Revenue...");

        const res = await client.query('SELECT SUM(amount) as total_revenue, COUNT(*) as total_count FROM sales_transactions');
        const total = parseFloat(res.rows[0].total_revenue);
        const count = parseInt(res.rows[0].total_count);

        console.log(`--------------------------------------------------`);
        console.log(`Total Records: ${count}`);
        console.log(`Total Revenue: $${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
        console.log(`--------------------------------------------------`);

        if (total > 100000000) {
            console.log("⚠ WARNING: Total exceeds $100M. Possible data corruption/multiplication.");
        } else {
            console.log("✅ Total is within expected range (~$32M).");
        }

        client.release();
    } catch (e) {
        console.error("Error:", e);
    } finally {
        pool.end();
    }
}

checkSum();
