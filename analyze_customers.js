
import 'dotenv/config'; // Load .env
import pg from 'pg';
const { Pool } = pg;

// Database Configuration
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

async function analyzeCustomers() {
    try {
        console.log("Analyzing Customers...");

        const client = await pool.connect();

        // 1. Total Count
        const countRes = await client.query('SELECT COUNT(*) FROM customers');
        console.log(`Total Customers: ${countRes.rows[0].count}`);

        // 2. Exact Name Duplicates
        const nameDupRes = await client.query(`
            SELECT name, COUNT(*) as cnt, SUM(annual_spend_goal) as total_spend
            FROM customers 
            GROUP BY name
            HAVING COUNT(*) > 1
            ORDER BY cnt DESC
            LIMIT 10
        `);

        console.log(`\nDuplicate Names found: ${nameDupRes.rows.length}`);
        if (nameDupRes.rows.length > 0) {
            console.log("Top 10 Duplicates:");
            nameDupRes.rows.forEach(r => {
                console.log(`- "${r.name}" | Count: ${r.cnt} | Sum Spend: $${parseFloat(r.total_spend).toLocaleString()}`);
            });
        }

        // 3. Estimate "Real" Total if Deduplicated
        // We take the MAX spend for each unique name (assuming duplicates are identical or similar)
        // Or AVG? If they are identical, distinct name sum is enough.
        const dedupSumRes = await client.query(`
            SELECT SUM(spend) as real_total FROM (
                SELECT DISTINCT ON (name) annual_spend_goal as spend
                FROM customers
            ) sub
        `);

        const dedupTotal = parseFloat(dedupSumRes.rows[0].real_total);
        console.log(`\n--------------------------------------------------`);
        console.log(`Estimated Unique Annual Spend: $${dedupTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
        console.log(`--------------------------------------------------`);

        client.release();
    } catch (e) {
        console.error("ErrorLimit:", e);
    } finally {
        pool.end();
    }
}

analyzeCustomers();
