// netlify/functions/server.js
// This file serves as the single entry point for all API logic (Express app)

const express = require('express');
const serverless = require('serverless-http');
const bodyParser = require('body-parser');

// --- CRITICAL IMPORTS ---
// Assuming these files are in netlify/functions/
const { dbCheck } = require('./middleware/dbCheck.js'); // Middleware to initialize DB
const { hashPassword, verifyPassword, generateToken } = require('./auth.js'); // Auth helpers
const db = require('./database.js'); // The pre-initialized DB instance

const app = express();
const router = express.Router(); // Use an Express router

// --- MIDDLEWARE ---
// Use body-parser for parsing application/json and extended URL-encoded data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// All routes are mounted under '/.netlify/functions/server/' by the wrapper.
// Express handles the path matching after Netlify routing strips the function name.
// e.g., A request for /api/register arrives here as /api/register.

// --- CORE AUTHENTICATION ROUTES ---

// Registration Endpoint: POST /api/register
router.post('/api/register', dbCheck, async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password || password.length < 6) {
        return res.status(400).json({ message: 'Email and a password of at least 6 characters are required.' });
    }

    try {
        // 1. Hash the password
        const hashedPassword = await hashPassword(password);
        
        // 2. Check if user already exists
        const existingUser = await db.get('SELECT user_id FROM users WHERE email = ?', [email]);
        if (existingUser) {
            return res.status(409).json({ message: 'User with this email already exists.' });
        }

        // 3. Insert new user
        await db.run('INSERT INTO users (email, hashed_password) VALUES (?, ?)', [email, hashedPassword]);
        
        // Success response
        res.status(201).json({ message: 'Registration successful.' });
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ message: 'Internal server error during registration.' });
    }
});

// Login Endpoint: POST /api/login
router.post('/api/login', dbCheck, async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await db.get('SELECT user_id, hashed_password FROM users WHERE email = ?', [email]);

        // 1. Verify user exists and password matches
        if (!user || !(await verifyPassword(password, user.hashed_password))) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }
        
        // 2. Generate and return JWT
        const token = generateToken(user.user_id);
        res.status(200).json({ message: 'Login successful.', token });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: 'Internal server error during login.' });
    }
});

// --- PLACEHOLDER FOR OTHER FEATURE ROUTES (e.g., Trefle API, Plants) ---
// Define these here or in separate modules if needed.
// Example: router.get('/api/plant-details/:name', dbCheck, authCheck, async (req, res) => { ... });

// --- APPLY ROUTER ---
// The Express router must be applied to the main app instance
app.use('/', router); 

// --- SERVERLESS WRAPPER (CRITICAL) ---
// Export the handler function required by Netlify Serverless
exports.handler = serverless(app);