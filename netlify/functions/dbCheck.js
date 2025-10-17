// netlify/functions/middleware/dbCheck.js
// Middleware to ensure the database is initialized before any route handler runs.

// Import the database promise from your database file
const { dbPromise } = require('../database.js'); 

/**
 * Middleware function that waits for the database connection promise to resolve.
 */
const dbCheck = async (req, res, next) => {
    try {
        // Wait for the database connection to be fully set up (tables created, etc.)
        await dbPromise;
        // If successful, proceed to the next middleware or route handler (e.g., handleRegistration)
        next();
    } catch (error) {
        // If the database setup failed (e.g., file system error, SQL syntax),
        // we stop the request and send a 500 error to the client.
        console.error("Database initialization failed in dbCheck middleware:", error);
        res.status(500).json({ 
            message: "Server is temporarily unavailable. Database initialization failed.", 
            details: error.message 
        });
    }
};

module.exports = { dbCheck };