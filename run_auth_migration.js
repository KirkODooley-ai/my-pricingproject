import { query, pool } from './server/db.js';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const migrationSql = fs.readFileSync('./migrations/auth_tables.sql', 'utf8');

async function runMigration() {
    try {
        console.log("Running Auth Migration...");

        // Generate a real hash for 'password123'
        const hash = await bcrypt.hash('password123', 10);
        console.log("Generated Hash for 'password123':", hash);

        // Replace placeholder in SQL with real hash (Checking if I should just run queries directly instead of parsing sql file which is fragile)
        // Better: Use query parameters or separate INSERTs. 
        // Let's just create the tables first.

        // 1. Create Tables
        const createTablesSql = `
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('admin', 'analyst', 'manager')),
                region TEXT, 
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS proposals (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                type TEXT NOT NULL,
                data JSONB NOT NULL,
                status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await query(createTablesSql);
        console.log("Tables Created.");

        // 2. Seed Users
        const users = [
            { username: 'admin', role: 'admin', region: null },
            { username: 'analyst', role: 'analyst', region: null },
            { username: 'manager_bc', role: 'manager', region: 'BC' },
            { username: 'manager_sask', role: 'manager', region: 'Sask' }
        ];

        for (const u of users) {
            await query(`
                INSERT INTO users (username, password_hash, role, region)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (username) DO NOTHING
            `, [u.username, hash, u.role, u.region]);
            console.log(`Seeded user: ${u.username}`);
        }

        console.log("Migration Complete.");
        process.exit(0);
    } catch (e) {
        console.error("Migration Failed:", e);
        process.exit(1);
    }
}

runMigration();
