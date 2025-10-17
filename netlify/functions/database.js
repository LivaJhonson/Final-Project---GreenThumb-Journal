// netlify/functions/database.js

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
// Note: We need 'dotenv/config' only if running locally outside of netlify dev
// We'll rely on the environment being set correctly by netlify dev for local testing.

// CRITICAL FIX: Use in-memory DB for reliable local testing (via netlify dev)
// Use /tmp path only when actually deployed to Netlify (process.env.NETLIFY is set)
const isNetlify = process.env.NETLIFY === 'true' || process.env.NETLIFY === 'TRUE';
const dbPath = isNetlify ? '/tmp/greenthumb.sqlite' : ':memory:'; 

// Variable to hold the database connection object once it's open
let db;

/**
 * Initializes the database connection and creates all necessary tables.
 */
async function setupDatabase() {
    try {
        // Assign the opened database to the 'db' variable
        db = await open({ 
            filename: dbPath,
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
        console.log(`Database connected (${dbPath}). 'users' table is ready.`);

        // 2. Create the 'plants' Table (WEEK 6)
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
                date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            );
        `);
        console.log("Database initialized: 'plants' table is ready (Week 6).");

        // 3. Create the 'reminders' Table (WEEK 7)
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
        throw error; 
    }
}

// Export the database promise (used to ensure setup runs)
const dbPromise = setupDatabase();

// Export using CommonJS (module.exports) to ensure compatibility with require() in server.js
module.exports = {
    dbPromise,
    getDb: async () => {
        if (!db) {
            db = await dbPromise; 
        }
        return db;
    }
};