import express from 'express';
import bcrypt from 'bcrypt'; 
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import 'dotenv/config';
import { dbPromise } from './database.js'; // Assuming database.js is in the same folder
import path from 'path'; 
import { fileURLToPath } from 'url'; 

// --- Path Setup for ES Modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); 

const app = express();
const PORT = process.env.PORT || 3000;
const saltRounds = 10; 

// --- Database Connection ---
// Await the promise to ensure the database is open and tables are created before routes run.
const db = await dbPromise.catch(err => {
    console.error("Critical: Database connection failed during server startup.", err);
    process.exit(1);
});


// --- Middleware ---
app.use(express.json()); 

// 1. Serve Static Files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '..', 'client'))); 


// 2. Define the Root Route (/) to send the login page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'login.html'));
});


// --- Authentication Middleware (WEEK 6) ---
// Function to verify JWT and attach user data to the request
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Expects: "Bearer <TOKEN>"

    if (token == null) {
        return res.status(401).json({ message: "Access denied. No token provided." });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: "Invalid or expired token." });
        }
        // Attach user info (id/user_id, email) to the request object
        req.user = user; 
        next();
    });
};


// --- API Endpoints ---

// POST /api/register - User Registration (WEEK 5)
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password || password.length < 6) {
        return res.status(400).json({ message: "Email is required and password must be at least 6 characters." });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        // Note: Assuming your users table uses 'user_id' as the primary key
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


// POST /api/login - User Login/Logout (WEEK 6 IMPLEMENTATION)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    // --- DEBUG LOGGING START ---
    console.log('\n--- LOGIN ATTEMPT RECEIVED ---');
    console.log(`Email: ${email}`);
    // --- DEBUG LOGGING END ---

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required." });
    }

    try {
        // Find the user by email (Using 'user_id' as defined in your database.js)
        // CRITICAL FIX: The parameter must be passed as an array [email]
        const user = await db.get('SELECT user_id, email, hashed_password FROM users WHERE email = ?', [email]);
        
        // --- DEBUG LOGGING START ---
        console.log('1. User Found:', !!user);
        if (user) {
            console.log(`   - User ID from DB: ${user.user_id}`);
        }
        // --- DEBUG LOGGING END ---

        if (!user) {
            // Added descriptive message for better client feedback
            return res.status(401).json({ message: "Invalid email or password. (User Not Found)" });
        }

        // Compare the provided password with the hashed password
        const match = await bcrypt.compare(password, user.hashed_password);

        // --- DEBUG LOGGING START ---
        console.log('2. Password Match Result:', match);
        // --- DEBUG LOGGING END ---

        if (!match) {
            // Added descriptive message for better client feedback
            return res.status(401).json({ message: "Invalid email or password. (Password Mismatch)" });
        }

        // Create a JWT (Token)
        const token = jwt.sign(
            { id: user.user_id, email: user.email }, // Use user_id as 'id' in token payload
            process.env.JWT_SECRET,
            { expiresIn: '1d' } // Token expires in 1 day
        );
        
        // --- DEBUG LOGGING START ---
        console.log('3. Login SUCCESS. Sending JWT.');
        // --- DEBUG LOGGING END ---

        // Send the token back to the client
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


// POST /api/identify - Plant Identification API Submission (WEEK 6)
app.post('/api/identify', authenticateToken, async (req, res) => {
    const { image_data } = req.body; // Expecting Base64 image string

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

        const data = await response.json();

        if (response.ok) {
            res.status(200).json(data);
        } else {
            console.error("Plant ID API Error:", data);
            res.status(response.status).json({ message: data.detail || "Error communicating with the plant identification service." });
        }

    } catch (error) {
        console.error("Server error during plant identification:", error);
        res.status(500).json({ message: "An internal server error occurred during API communication." });
    }
});

// GET /api/plant-details/:scientific_name - Fetch Supplemental Trefle Data (WEEK 6 ADDITION)
app.get('/api/plant-details/:scientific_name', authenticateToken, async (req, res) => {
    const scientificName = req.params.scientific_name;

    if (!scientificName) {
        return res.status(400).json({ message: "Scientific name is required." });
    }

    // NOTE: This assumes Trefle is used and TREFLE_API_KEY is configured in .env
    const trefleUrl = `https://trefle.io/api/v1/species/search?q=${encodeURIComponent(scientificName)}&token=${process.env.TREFLE_API_KEY}`;

    try {
        const response = await fetch(trefleUrl);
        const data = await response.json();

        if (response.ok) {
            // Success: Return the supplemental data
            res.status(200).json(data);
        } else {
            // Trefle/External API Error Handling
            console.error("Trefle API Error:", data);
            res.status(response.status).json({ message: data.error || "Error fetching supplemental plant details." });
        }
    } catch (error) {
        console.error("Server error during supplemental data retrieval:", error);
        res.status(500).json({ message: "An internal server error occurred during API communication." });
    }
});


// POST /api/plants - Write Function to Save Plant to User Collection (WEEK 6)
app.post('/api/plants', authenticateToken, async (req, res) => {
    const { name, scientific_name, common_name, image_url, notes } = req.body;
    const user_id = req.user.id; // User ID from the JWT payload

    if (!name || !user_id) {
        return res.status(400).json({ message: "Plant name and user ID are required." });
    }

    try {
        // Note: Using 'user_id' to match your 'plants' table foreign key
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


// GET /api/plants - Develop 'My Plants' Dashboard Card View (WEEK 6)
app.get('/api/plants', authenticateToken, async (req, res) => {
    const user_id = req.user.id;
    try {
        const plants = await db.all('SELECT * FROM plants WHERE user_id = ? ORDER BY date_added DESC', user_id);
        res.status(200).json(plants);
    } catch (error) {
        console.error("Error fetching plants:", error);
        res.status(500).json({ message: "Failed to retrieve user's plant collection." });
    }
});


// GET /api/plants/:id - Build Detailed Plant Profile View (WEEK 6)
app.get('/api/plants/:id', authenticateToken, async (req, res) => {
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


// DELETE /api/plants/:id - Implement Plant Deletion Functionality (WEEK 6)
app.delete('/api/plants/:id', authenticateToken, async (req, res) => {
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


// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});