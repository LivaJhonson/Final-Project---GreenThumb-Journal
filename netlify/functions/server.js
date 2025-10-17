// netlify/functions/server.js

import express from 'express';
// --- IMPORTANT: Use the 'netlify' adapter for Express ---
import serverless from 'serverless-http'; 
import bcrypt from 'bcrypt'; 
import 'dotenv/config'; 
import { dbPromise } from './database.js'; // NOTE: Adjusted Path!

// We can remove the path imports for static files since Netlify handles them separately.
// The DB logic remains the same.
let db;
dbPromise.then(instance => {
    db = instance;
}).catch(err => {
    console.error("Critical: Database connection failed during server startup.", err);
    // Note: Can't use process.exit(1) in a serverless function, but logging the error is important.
});


const app = express();
app.use(express.json()); 

// IMPORTANT: Do NOT include app.use(express.static('client')) or app.listen()
// Netlify serves the 'client' folder automatically as static assets.


// --- API Endpoints ---

// Task: User Registration
app.post('/api/register', async (req, res) => {
    // *** The exact same logic as before ***
    const { email, password } = req.body;

    if (!email || !password || password.length < 6) {
        return res.status(400).json({ message: "Email is required and password must be at least 6 characters." });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10); // Using 10 saltRounds

        await db.run(
            'INSERT INTO users (email, hashed_password) VALUES (?, ?)',
            [email, hashedPassword]
        );

        res.status(201).json({ 
            message: "Registration successful! Redirecting to login."
        });

    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ message: "Error: A user with this email already exists." });
        }
        console.error("Server registration error:", error);
        res.status(500).json({ message: "An internal server error occurred." });
    }
});

// Task: User Login/Logout (Placeholder)
app.post('/api/login', async (req, res) => {
    res.status(501).json({ message: "Login authentication is currently under development (Week 6 goal)." }); 
});


// 4. Export the handler for Netlify
export const handler = serverless(app);