-- Add is_active, permissions, and updated_at columns for enhanced user management
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NULL;

-- Migrate existing bc_sales and sask_sales users to outside_sales (before constraint change)
UPDATE users SET role = 'outside_sales' WHERE role IN ('bc_sales', 'sask_sales');

-- Update role constraint: outside_sales, sales_manager, sales_support (merge BC/Sask Sales into Outside Sales)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('admin', 'analyst', 'manager', 'outside_sales', 'sales_manager', 'sales_support'));

-- Allow proposals.user_id to be NULL so we can orphan proposals when deleting users
ALTER TABLE proposals ALTER COLUMN user_id DROP NOT NULL;
