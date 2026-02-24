-- Add can_edit column for simple edit permission
-- Admins bypass this check in middleware; non-admins need can_edit = true to modify data
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_edit BOOLEAN DEFAULT false;

-- Set can_edit = true for all current Admins
UPDATE users SET can_edit = true WHERE role = 'admin';
