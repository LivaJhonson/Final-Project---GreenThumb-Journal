import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import 'dotenv/config'; 

// --- CRITICAL FIX FOR NETLIFY: USE IN-MEMORY DATABASE ---
// Netlify deletes files in /tmp between function calls. 
// Using ':memory:' ensures the database initializes quickly and successfully
// every time the function starts (though data is LOST upon function sleep/wake).
const dbFile = ':memory:'; 

// Variable to hold the database connection object once it's open
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

        // 1. Create the 'users' Table (WEEK 5)
        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Database initialized: 'users' table is ready (Week 5).");

        // 2. Create the 'plants' Table (WEEK 6)
        // Added 'trefle_id' which is used in the revised server.js for rich data fetch
        await db.exec(`
            CREATE TABLE IF NOT EXISTS plants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL, 
                name TEXT NOT NULL,
                scientific_name TEXT,
                common_name TEXT,
                image_url TEXT,
                notes TEXT,
                identification_data TEXT, -- Stores JSON response from Plant.ID (Week 6)
                trefle_id TEXT,           -- Added for Trefle API detail fetching (Revised Week 7)
                date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            );
        `);
        console.log("Database initialized: 'plants' table is ready (Week 6/7).");

        // 3. Create the 'reminders' Table (WEEK 7)
        await db.exec(`
            CREATE TABLE IF NOT EXISTS reminders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                plant_id INTEGER NOT NULL,
                type TEXT NOT NULL, -- e.g., 'water', 'feed', 'prune'
                frequency_days INTEGER NOT NULL,
                last_completed DATE DEFAULT (strftime('%Y-%m-%d', 'now')),
                next_due DATE,
                FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
            );
        `);
        console.log("Database initialized: 'reminders' table is ready (Week 7).");

        // 4. Create the 'growth_photos' Table (WEEK 7)
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
        console.log("Database initialized: 'growth_photos' table is ready (Week 7).");

        // Return the ready-to-use db connection object
        return db;
    } catch (error) {
        console.error("Failed to set up database:", error);
        // Throw the error so the server.js catch block can handle it
        throw error; 
    }
}

// Export the database promise (used to ensure setup runs)
const dbPromise = setupDatabase();
export { dbPromise };

// The getDb function is good practice, but not strictly needed if server.js uses the 'await dbPromise' pattern.
// We'll keep it as it doesn't hurt.
export const getDb = async () => {
    // If 'db' is not yet assigned, wait for it.
    if (!db) {
        db = await dbPromise; 
    }
    return db;
};