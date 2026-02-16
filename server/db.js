import pg from 'pg';
const { Pool, types } = pg;

// FIX: PostgreSQL returns NUMERIC/DECIMAL as strings by default.
// We must force them to be floats so frontend math (reduce/sum) works correctly.
types.setTypeParser(1700, (val) => parseFloat(val));

// Database Configuration
// defaults to env vars if set, otherwise uses local defaults
const pool = new Pool({
    user: process.env.PGUSER || 'postgres',
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE || 'pricing_test',
    password: process.env.PGPASSWORD, // User MUST provide this in env
    port: process.env.PGPORT || 3006,
});

// Test the connection
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

export const query = (text, params) => pool.query(text, params);
export const getClient = () => pool.connect();
export default pool;
