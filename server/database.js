import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import 'dotenv/config'; 

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

        // 2. Create the 'plants' Table (NEW FOR WEEK 6)
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

// Export the database promise so server.js can await it
const dbPromise = setupDatabase();

// Export a getter function to access the initialized db connection object easily
export const getDb = async () => {
    // Await the promise to ensure the database is open and tables are created
    if (!db) {
        db = await dbPromise; 
    }
    return db;
};

// Also export the promise for backward compatibility if needed
export { dbPromise };