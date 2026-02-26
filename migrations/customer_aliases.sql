-- Customer aliases: link transaction names (alias_name) to canonical customer (canonical_id = customer_id)
CREATE TABLE IF NOT EXISTS customer_aliases (
    id SERIAL PRIMARY KEY,
    alias_name TEXT NOT NULL,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(alias_name)
);

CREATE INDEX IF NOT EXISTS idx_customer_aliases_alias ON customer_aliases(alias_name);
CREATE INDEX IF NOT EXISTS idx_customer_aliases_customer ON customer_aliases(customer_id);
