-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'analyst', 'manager')),
    region TEXT, -- Nullable, used for Managers (e.g., 'BC', 'Sask')
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pricing Proposals Table (for Analysts)
CREATE TABLE IF NOT EXISTS proposals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    type TEXT NOT NULL, -- e.g., 'pricing_strategy'
    data JSONB NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Default Users (Password: 'password123' hashed with bcrypt cost 10)
-- Passwords should be changed in production!
INSERT INTO users (username, password_hash, role, region)
VALUES 
    ('admin', '$2a$10$X7.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1', 'admin', NULL), -- Placeholder hash, need real one
    ('analyst', '$2a$10$X7.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1', 'analyst', NULL),
    ('manager_bc', '$2a$10$X7.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1', 'manager', 'BC'),
    ('manager_sask', '$2a$10$X7.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1', 'manager', 'Sask')
ON CONFLICT (username) DO NOTHING;
