
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

async function deduplicateCustomers() {
    console.log("Starting Customer Deduplication...");
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Find Duplicates (Group by Name)
        const res = await client.query(`
            SELECT name, array_agg(id ORDER BY id ASC) as ids
            FROM customers
            GROUP BY name
            HAVING COUNT(*) > 1
        `);

        console.log(`Found ${res.rows.length} customers with duplicates.`);

        let deletedCount = 0;
        let remappedCount = 0;

        for (const row of res.rows) {
            const [keepId, ...deleteIds] = row.ids; // Keep the first one (Earliest ID)

            for (const deleteId of deleteIds) {
                // 2. Remap Sales Transactions
                const updateRes = await client.query(`
                    UPDATE sales_transactions 
                    SET customer_id = $1 
                    WHERE customer_id = $2
                `, [keepId, deleteId]);

                if (updateRes.rowCount > 0) {
                    console.log(`- Remapped ${updateRes.rowCount} sales from ${deleteId} to ${keepId} (${row.name})`);
                    remappedCount += updateRes.rowCount;
                }

                // 2b. Remap Customer Aliases
                const aliasUpdateRes = await client.query(`
                    UPDATE customer_aliases
                    SET customer_id = $1
                    WHERE customer_id = $2
                `, [keepId, deleteId]);

                // 3. Delete Duplicate Customer
                await client.query('DELETE FROM customers WHERE id = $1', [deleteId]);
                deletedCount++;
            }
        }

        // 4. Add Unique Constraint to prevent future duplicates
        try {
            await client.query('ALTER TABLE customers ADD CONSTRAINT unique_customer_name UNIQUE (name);');
            console.log("✅ Added UNIQUE constraint to customers(name).");
        } catch (e) {
            console.warn("⚠ Could not add unique constraint:", e.message);
        }

        await client.query('COMMIT');
        console.log(`SUCCESS: Deleted ${deletedCount} duplicate customers. Remapped ${remappedCount} sales records.`);

    } catch (e) {
        await client.query('ROLLBACK');
        console.error("FAILED. Rolled back.", e);
    } finally {
        client.release();
        pool.end();
    }
}

deduplicateCustomers();
