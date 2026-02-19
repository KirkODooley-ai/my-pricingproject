
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO settings (key, value)
VALUES ('global_multiplier', '{"value": 1.5}')
ON CONFLICT (key) DO NOTHING;
