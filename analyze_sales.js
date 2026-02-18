
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

async function analyze() {
    try {
        console.log("Analyzing Sales Transactions...");

        const client = await pool.connect();

        // 1. Total Count
        const countRes = await client.query('SELECT COUNT(*) FROM sales_transactions');
        console.log(`Total Rows: ${countRes.rows[0].count}`);

        // 2. Exact ID Duplicates (Should be 0 if ID is PK)
        const idDupRes = await client.query(`
            SELECT id, COUNT(*) 
            FROM sales_transactions 
            GROUP BY id 
            HAVING COUNT(*) > 1
        `);
        console.log(`Duplicate IDs found: ${idDupRes.rows.length}`);

        // 3. Logical Duplicates (Customer, Date, Amount, Category)
        // [MODIFIED] Check sample data to verify format
        const sampleRes = await client.query('SELECT * FROM sales_transactions LIMIT 5');
        console.log("Sample Data:", JSON.stringify(sampleRes.rows, null, 2));

        const logicalDupRes = await client.query(`
            SELECT customer_name_snapshot, transaction_date, amount, category_name_snapshot, COUNT(*) as cnt
            FROM sales_transactions 
            GROUP BY customer_name_snapshot, transaction_date, amount, category_name_snapshot
            HAVING COUNT(*) > 1
            ORDER BY cnt DESC
            LIMIT 5
        `);
        console.log(`\nTop 5 Logical Duplicate Groups (Same Customer, Date, Amount, Cat):`);
        logicalDupRes.rows.forEach(r => {
            console.log(`- ${r.customer_name_snapshot} | ${r.category_name_snapshot} | $${r.amount} | ${r.transaction_date} => Count: ${r.cnt}`);
        });

        const totalLogicalDupsRes = await client.query(`
             SELECT SUM(cnt) - COUNT(*) as removable_rows FROM (
                SELECT COUNT(*) as cnt
                FROM sales_transactions 
                GROUP BY customer_name_snapshot, transaction_date, amount, category_name_snapshot
                HAVING COUNT(*) > 1
             ) sub
        `);
        console.log(`\nEstimated Removable Rows (Logical Duplicates): ${totalLogicalDupsRes.rows[0].removable_rows || 0}`);

        client.release();
    } catch (e) {
        console.error("Error:", e);
    } finally {
        pool.end();
    }
}

analyze();
