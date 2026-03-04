-- Add UNIQUE index on alias_name for ON CONFLICT (alias_name) upsert support.
-- Required for: INSERT ... ON CONFLICT (alias_name) DO UPDATE in customer alias linking.
-- Safe to run: skips if index already exists. ON CONFLICT uses unique indexes.

-- Remove duplicates if any (keep row with smallest id per alias_name)
DELETE FROM customer_aliases a
USING customer_aliases b
WHERE a.id > b.id AND a.alias_name = b.alias_name;

CREATE UNIQUE INDEX IF NOT EXISTS customer_aliases_alias_name_key ON customer_aliases(alias_name);
