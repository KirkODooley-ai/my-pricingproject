import { query } from './server/db.js';

async function runMigration() {
    try {
        console.log('Running User Management Upgrade Migration...');

        await query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NULL;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS can_edit BOOLEAN DEFAULT false;
        `);
        await query(`UPDATE users SET can_edit = true WHERE role = 'admin' AND (can_edit IS NULL OR can_edit = false);`);
        console.log('Added is_active, permissions, updated_at, can_edit columns.');

        await query(`UPDATE users SET role = 'outside_sales' WHERE role IN ('bc_sales', 'sask_sales');`);
        console.log('Migrated bc_sales/sask_sales users to outside_sales.');

        await query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;');
        await query(`
            ALTER TABLE users ADD CONSTRAINT users_role_check
            CHECK (role IN ('admin', 'analyst', 'manager', 'outside_sales', 'sales_manager', 'sales_support'));
        `);
        console.log('Updated role constraint: outside_sales, sales_manager, sales_support.');

        try {
            await query('ALTER TABLE proposals ALTER COLUMN user_id DROP NOT NULL;');
            console.log('Made proposals.user_id nullable for user deletion.');
        } catch (e) {
            if (!e.message?.includes('already') && !e.message?.includes('null')) console.warn('Proposals user_id alter:', e.message);
        }

        console.log('Migration complete.');
        process.exit(0);
    } catch (e) {
        console.error('Migration failed:', e);
        process.exit(1);
    }
}

runMigration();
