// netlify/functions/server.mjs - The Netlify Serverless Handler

import express from 'express';
import serverless from 'serverless-http'; // CRITICAL: Import serverless wrapper
import bcrypt from 'bcrypt'; 
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import cors from 'cors'; // Added cors for robust API behavior
// CRITICAL: Updated import path to use the corrected database.mjs file
import { dbPromise } from './database.mjs'; 

// --- Database Connection Setup (CRITICAL FOR SERVERLESS) ---
let db;
// The top-level await is safe because we are using the .mjs extension
// This ensures the DB is initialized and tables are created BEFORE any request is handled.
await (async () => {
    try {
        db = await dbPromise;
        console.log("Database connection established successfully on cold start.");
    } catch (err) {
        console.error("Critical: Database connection failed during server startup.", err);
        // Do NOT exit the process; let the handler return a 500 error on request.
    }
})();

// --- UTILITIES ---
function calculateNextDueDateSQL(lastCompletedDate, frequencyDays) {
    return `strftime('%Y-%m-%d', '${lastCompletedDate}', '+${frequencyDays} day')`;
}

// --- Express App Setup ---
const app = express();
app.use(cors({ origin: '*' })); // Allow all origins (or restrict this later)
app.use(express.json()); 

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ message: "Access denied. No token provided." });
    }

    // Uses process.env.JWT_SECRET from Netlify Environment Variables
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: "Invalid or expired token." });
        }
        req.user = user; 
        next();
    });
};

// CRITICAL: Check for DB connection failure at the start of every route
const dbCheck = (req, res, next) => {
    if (!db) {
        return res.status(500).json({ message: "Database service is unavailable." });
    }
    next();
};

// --- API Endpoints ---
// Apply dbCheck middleware to all API routes
app.post('/api/register', dbCheck, async (req, res) => { /* Registration logic */ ... });
app.post('/api/login', dbCheck, async (req, res) => { /* Login logic */ ... });
app.post('/api/identify', dbCheck, authenticateToken, async (req, res) => { /* Plant ID logic */ ... });
// ... (Paste all your remaining API routes here, wrapping them in dbCheck or dbCheck/authenticateToken) ...

// --- Serverless Handler Export ---

// The local path/file serving logic is removed, as Netlify handles static files separately.
// The app.listen() call is removed.

// CRITICAL: Export the Express app wrapped by serverless-http
export const handler = serverless(app);