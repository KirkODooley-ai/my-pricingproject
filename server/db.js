import 'dotenv/config'; // Load .env
import pg from 'pg';
const { Pool, types } = pg;

// FIX: PostgreSQL returns NUMERIC/DECIMAL as strings by default.
// We must force them to be floats so frontend math (reduce/sum) works correctly.
types.setTypeParser(1700, (val) => parseFloat(val));

// Database Configuration
// Database Configuration
// Database Configuration
const dbConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }, // Required for Neon
        port: 5432 // [FIX] Explicitly force standard Postgres port to override any local defaults/env vars
    }
    : {
        user: process.env.PGUSER || 'postgres',
        host: process.env.PGHOST || 'localhost',
        database: process.env.PGDATABASE || 'pricing_test',
        password: process.env.PGPASSWORD,
        port: process.env.PGPORT || 3006,
    };

// [FIX] Optimized Pool Settings for Cloud (Neon)
// - max: Limit concurrent connections to avoid overwhelming the db
// - idleTimeoutMillis: Close idle clients after 30s
// - connectionTimeoutMillis: Fail fast (2s) if DB is unresponsive
const poolConfig = {
    ...dbConfig,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};

const pool = new Pool(poolConfig);

// Test the connection
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// [NEW] Routine to Kill Zombie Connections on Startup
export const killZombieConnections = async () => {
    const client = await pool.connect();
    try {
        console.log("🧹 Checking for zombie connections...");
        const res = await client.query(`
            SELECT pid, state, query_start 
            FROM pg_stat_activity 
            WHERE datname = current_database() 
            AND pid <> pg_backend_pid()
            AND (state = 'idle' OR state = 'idle in transaction')
        `);

        if (res.rows.length > 0) {
            console.log(`Found ${res.rows.length} idle connections. Terminating...`);
            await client.query(`
                SELECT pg_terminate_backend(pid) 
                FROM pg_stat_activity 
                WHERE datname = current_database() 
                AND pid <> pg_backend_pid()
                AND (state = 'idle' OR state = 'idle in transaction')
            `);
            console.log("✅ Terminated zombie connections.");
        } else {
            console.log("✅ No zombie connections found.");
        }
    } catch (e) {
        console.warn("⚠ Failed to cleanup connections (might lack permissions):", e.message);
    } finally {
        client.release();
    }
};

// [NEW] Retry Logic for Stability
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const query = async (text, params, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await pool.query(text, params);
        } catch (err) {
            const isTimeout = err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET' || err.message.includes('timeout');
            if (isTimeout && i < retries - 1) {
                const delay = Math.pow(2, i) * 1000; // Exponential Backoff: 1s, 2s, 4s
                console.warn(`⚠ DB Query Timeout. Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
                await sleep(delay);
            } else {
                throw err; // Configuring DB Retry Logic
            }
        }
    }
};

export const getClient = () => pool.connect();
export default pool;
