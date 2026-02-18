
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

async function addConstraint() {
    try {
        const client = await pool.connect();
        console.log("Attempting to add PRIMARY KEY constraint to 'id'...");

        try {
            await client.query('ALTER TABLE sales_transactions ADD PRIMARY KEY (id);');
            console.log("✅ PRIMARY KEY constraint added successfully.");
        } catch (e) {
            if (e.code === '42P16') { // Multiple primary keys
                console.log("ℹ PRIMARY KEY already exists (Expected).");
            } else {
                console.log(`ℹ Notice: ${e.message}`);
            }
        }

        client.release();
    } catch (e) {
        console.error("Error connecting:", e);
    } finally {
        pool.end();
    }
}

addConstraint();
