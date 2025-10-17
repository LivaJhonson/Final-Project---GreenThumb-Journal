// netlify/functions/server.mjs

import express from 'express';
import serverless from 'serverless-http'; 
import bcrypt from 'bcrypt'; 
import cors from 'cors'; 
// CRITICAL FIX: Ensure the import path uses the .mjs extension
import { dbPromise } from './database.mjs'; 

// --- DATABASE CONNECTION SETUP ---
let db;
// This top-level await is safe because we are using the .mjs extension
await (async () => {
    try {
        db = await dbPromise;
    } catch (err) {
        console.error("CRITICAL: DB connection failed on cold start.", err);
    }
})();

const app = express();
app.use(cors({ origin: '*' })); 
app.use(express.json()); 

// --- API Endpoints ---

// POST /api/register - Test route
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;

    // Check for catastrophic DB failure first
    if (!db) { return res.status(500).json({ message: "Database connection failed." }); }

    // Minimal validation
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required." });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10); 
        await db.run(
            'INSERT INTO users (email, hashed_password) VALUES (?, ?)',
            [email, hashedPassword]
        );
        res.status(201).json({ message: "Registration successful!" });
    } catch (error) {
        // Handle unique constraint error (user already exists)
        if (error.message && error.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ message: "Error: A user with this email already exists." });
        }
        console.error("Server registration error:", error);
        res.status(500).json({ message: "An internal server error occurred." });
    }
});


// Export the handler for Netlify (CRITICAL)
export const handler = serverless(app);