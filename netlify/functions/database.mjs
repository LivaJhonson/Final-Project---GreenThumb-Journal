// netlify/functions/database.mjs

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// CRITICAL FIX: Use :memory: to prevent I/O errors on Netlify's read-only filesystem.
const dbFile = ':memory:'; 

async function setupDatabase() {
    try {
        const db = await open({ 
            filename: dbFile,
            driver: sqlite3.Database
        });

        // 1. Create the 'users' Table
        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        // ... include all your other CREATE TABLE statements here (plants, reminders, photos)
        await db.exec(`
            CREATE TABLE IF NOT EXISTS plants (...);
        `);
        // ... and so on

        console.log("Database initialized successfully.");
        return db;
    } catch (error) {
        console.error("Failed to set up database:", error);
        throw error; 
    }
}

// Export the database promise
export const dbPromise = setupDatabase();