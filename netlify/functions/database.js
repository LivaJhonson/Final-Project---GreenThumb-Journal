import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
// Note: 'dotenv/config' is often not needed here if variables are set in Netlify
import 'dotenv/config'; 

// This path is CRITICAL for Netlify. It must point to where your SQLite file lives.
// Assuming your SQLite file is placed in the project root or the same directory 
// that Netlify copies to the function's execution environment. 
// A common pattern is to point to the file that was deployed with your build.
// NOTE: Ensure your Netlify environment variable DB_FILE is set correctly (e.g., "./greenthumb.sqlite").
const dbFile = process.env.DB_FILE;

// Variable to hold the database connection object once it's open
let db;

/**
 * Initializes the database connection and creates the 'users' and 'plants' tables.
 */
async function setupDatabase() {
    try {
        // Assign the opened database to the 'db' variable
        db = await open({ 
            filename: dbFile,
            driver: sqlite3.Database
        });

        // 1. Create the 'users' Table (Existing logic)
        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Database initialized: 'users' table is ready.");

        // 2. Create the 'plants' Table (WEEK 6 ADDITION) 🌿
        await db.exec(`
            CREATE TABLE IF NOT EXISTS plants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,          
                name TEXT NOT NULL,
                scientific_name TEXT,
                common_name TEXT,
                image_url TEXT,
                notes TEXT,
                date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            );
        `);
        console.log("Database initialized: 'plants' table is ready.");

        // Return the ready-to-use db connection object
        return db;
    } catch (error) {
        console.error("Failed to set up database:", error);
        throw error; 
    }
}

// Export the database promise (used to ensure setup runs)
const dbPromise = setupDatabase();
export { dbPromise };

// Export a helper function (getDb) for clean access in API routes
export const getDb = async () => {
    // If 'db' is not yet assigned, wait for it.
    if (!db) {
        db = await dbPromise; 
    }
    return db;
};