import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import 'dotenv/config'; 

const dbFile = process.env.DB_FILE;

/**
 * Initializes the database connection and creates the 'users' table.
 */
async function setupDatabase() {
    try {
        const db = await open({
            filename: dbFile,
            driver: sqlite3.Database
        });

        // Task: Create 'users' Database Table
        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log("Database initialized. 'users' table is ready.");
        return db;
    } catch (error) {
        console.error("Failed to set up database:", error);
        throw error; 
    }
}

// Export the database promise for use in server.js
const dbPromise = setupDatabase();
export { dbPromise };