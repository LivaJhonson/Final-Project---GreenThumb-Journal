// netlify/functions/server.js

import express from 'express';
// --- IMPORTANT: Use the 'netlify' adapter for Express ---
import serverless from 'serverless-http'; 
import bcrypt from 'bcrypt'; 
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import 'dotenv/config'; 
import { dbPromise } from './database.js';

// --- Database Connection Setup ---
let db;
// Await the promise to ensure the database is open and tables are created before routes run.
dbPromise.then(instance => {
    db = instance;
}).catch(err => {
    console.error("Critical: Database connection failed during server startup.", err);
});

const app = express();
app.use(express.json()); 

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization']; 
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ message: "Access denied. No token provided." });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            // Log the error detail for Netlify debugging
            console.error("JWT Verification Failed:", err.message); 
            return res.status(403).json({ message: "Invalid or expired token." });
        }
        req.user = user; 
        next();
    });
};


// --- API Endpoints ---

// POST /api/register - User Registration
app.post('/api/register', async (req, res) => {
    // ... (No functional changes needed here) ...
    const { email, password } = req.body;

    if (!email || !password || password.length < 6) {
        return res.status(400).json({ message: "Email is required and password must be at least 6 characters." });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10); 

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


// POST /api/login - User Login (FIXED)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required." });
    }

    try {
        // FIX: Added the array wrapper [email] for the sqlite parameter.
        const user = await db.get('SELECT user_id, email, hashed_password FROM users WHERE email = ?', [email]);
        
        if (!user) {
            // Added descriptive error message
            return res.status(401).json({ message: "Invalid email or password. (User Not Found)" });
        }

        const match = await bcrypt.compare(password, user.hashed_password);

        if (!match) {
            // Added descriptive error message
            return res.status(401).json({ message: "Invalid email or password. (Password Mismatch)" });
        }

        const token = jwt.sign(
            { id: user.user_id, email: user.email }, 
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.status(200).json({ 
            message: "Login successful.", 
            token: token,
            user: { id: user.user_id, email: user.email }
        });

    } catch (error) {
        console.error("Login server error:", error);
        res.status(500).json({ message: "An internal server error occurred during login." });
    }
});


// POST /api/identify - Plant Identification API Submission (FIXED)
app.post('/api/identify', authenticateToken, async (req, res) => {
    const { image_data } = req.body;

    if (!image_data) {
        return res.status(400).json({ message: "Image data is required for identification." });
    }

    const identificationUrl = 'https://api.plant.id/v2/identify';
    const apiKey = process.env.PLANT_ID_API_KEY;

    try {
        const response = await fetch(identificationUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: apiKey,
                images: [image_data],
                modifiers: ["similar_images"],
                plant_details: ["common_names", "taxonomy", "url"]
            })
        });

        // FIX: The API sometimes returns non-JSON error text. We must check the status 
        // before attempting to parse the body as JSON.
        if (!response.ok) {
            // CRITICAL FIX: Read the body as text first to avoid the JSON parsing error
            const errorText = await response.text();
            
            // Log the raw error text for Netlify debugging
            console.error(`Plant ID API Error (Status ${response.status}):`, errorText.substring(0, 100)); 
            
            let message = "Error communicating with the plant identification service.";
            
            // Attempt to parse as JSON if it looks like a JSON error structure
            try {
                const errorData = JSON.parse(errorText);
                message = errorData.detail || message;
            } catch (e) {
                // If it's not JSON (like the "The specif..." error), return a generic message
                message = `API Key Issue. Details: ${errorText.substring(0, 40)}...`;
            }

            return res.status(response.status).json({ message: message });
        }

        const data = await response.json();
        res.status(200).json(data);

    } catch (error) {
        console.error("Server error during plant identification:", error);
        res.status(500).json({ message: "An internal server error occurred during API communication." });
    }
});


// GET /api/plant-details/:scientific_name - Fetch Supplemental Trefle Data
app.get('/api/plant-details/:scientific_name', authenticateToken, async (req, res) => { 
    // ... (No functional changes needed here) ...
    const scientificName = req.params.scientific_name;

    if (!scientificName) {
        return res.status(400).json({ message: "Scientific name is required." });
    }

    const trefleUrl = `https://trefle.io/api/v1/species/search?q=${encodeURIComponent(scientificName)}&token=${process.env.TREFLE_API_KEY}`;

    try {
        const response = await fetch(trefleUrl);
        const data = await response.json();

        if (response.ok) {
            res.status(200).json(data);
        } else {
            console.error("Trefle API Error:", data);
            res.status(response.status).json({ message: data.error || "Error fetching supplemental plant details." });
        }
    } catch (error) {
        console.error("Server error during supplemental data retrieval:", error);
        res.status(500).json({ message: "An internal server error occurred during API communication." });
    }
});


// POST /api/plants - Write Function to Save Plant to User Collection
app.post('/api/plants', authenticateToken, async (req, res) => {
    // ... (No functional changes needed here) ...
    const { name, scientific_name, common_name, image_url, notes } = req.body;
    const user_id = req.user.id;

    if (!name || !user_id) {
        return res.status(400).json({ message: "Plant name and user ID are required." });
    }

    try {
        const result = await db.run(
            'INSERT INTO plants (user_id, name, scientific_name, common_name, image_url, notes) VALUES (?, ?, ?, ?, ?, ?)',
            [user_id, name, scientific_name, common_name, image_url || null, notes || null]
        );

        res.status(201).json({ 
            message: "Plant successfully added to your collection.",
            plant_id: result.lastID
        });

    } catch (error) {
        console.error("Error saving plant:", error);
        res.status(500).json({ message: "Failed to save the plant to the database." });
    }
});


// GET /api/plants - Develop 'My Plants' Dashboard Card View
app.get('/api/plants', authenticateToken, async (req, res) => {
    // ... (No functional changes needed here) ...
    const user_id = req.user.id;
    try {
        const plants = await db.all('SELECT * FROM plants WHERE user_id = ? ORDER BY date_added DESC', user_id);
        res.status(200).json(plants);
    } catch (error) {
        console.error("Error fetching plants:", error);
        res.status(500).json({ message: "Failed to retrieve user's plant collection." });
    }
});


// GET /api/plants/:id - Build Detailed Plant Profile View
app.get('/api/plants/:id', authenticateToken, async (req, res) => {
    // ... (No functional changes needed here) ...
    const plant_id = req.params.id;
    const user_id = req.user.id;
    try {
        const plant = await db.get('SELECT * FROM plants WHERE id = ? AND user_id = ?', plant_id, user_id);
        if (!plant) {
            return res.status(404).json({ message: "Plant not found or does not belong to user." });
        }
        res.status(200).json(plant);
    } catch (error) {
        console.error("Error fetching single plant:", error);
        res.status(500).json({ message: "Failed to retrieve plant details." });
    }
});


// DELETE /api/plants/:id - Implement Plant Deletion Functionality
app.delete('/api/plants/:id', authenticateToken, async (req, res) => {
    // ... (No functional changes needed here) ...
    const plant_id = req.params.id;
    const user_id = req.user.id;
    try {
        const result = await db.run('DELETE FROM plants WHERE id = ? AND user_id = ?', plant_id, user_id);
        if (result.changes === 0) {
            return res.status(404).json({ message: "Plant not found or could not be deleted." });
        }
        res.status(200).json({ message: "Plant successfully deleted." });
    } catch (error) {
        console.error("Error deleting plant:", error);
        res.status(500).json({ message: "Failed to delete the plant." });
    }
});


// Export the handler for Netlify (CRITICAL)
export const handler = serverless(app);