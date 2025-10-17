import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// --- CRITICAL FOR NETLIFY: USE IN-MEMORY DATABASE ---
// Data is NOT persistent between function calls.
const dbFile = ':memory:'; 

let db;

/**
 * Initializes the database connection and creates all necessary tables.
 */
async function setupDatabase() {
    try {
        // Assign the opened database to the 'db' variable
        db = await open({ 
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
        console.log("Database initialized: 'users' table is ready.");

        // 2. Create the 'plants' Table 
        await db.exec(`
            CREATE TABLE IF NOT EXISTS plants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL, 
                name TEXT NOT NULL,
                scientific_name TEXT,
                common_name TEXT,
                image_url TEXT,
                notes TEXT,
                identification_data TEXT,
                trefle_id TEXT, 
                date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            );
        `);
        console.log("Database initialized: 'plants' table is ready.");

        // 3. Create the 'reminders' Table
        await db.exec(`
            CREATE TABLE IF NOT EXISTS reminders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                plant_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                frequency_days INTEGER NOT NULL,
                last_completed DATE DEFAULT (strftime('%Y-%m-%d', 'now')),
                next_due DATE,
                FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
            );
        `);
        console.log("Database initialized: 'reminders' table is ready.");

        // 4. Create the 'growth_photos' Table
        await db.exec(`
            CREATE TABLE IF NOT EXISTS growth_photos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                plant_id INTEGER NOT NULL,
                image_url TEXT NOT NULL,
                date_taken TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                notes TEXT,
                FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
            );
        `);
        console.log("Database initialized: 'growth_photos' table is ready.");

        return db;
    } catch (error) {
        console.error("Failed to set up database:", error);
        throw error; 
    }
}

// Export the database promise (used to ensure setup runs)
export const dbPromise = setupDatabase();