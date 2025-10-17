// server/local-server.js
import express from 'express';
import bcrypt from 'bcrypt'; 
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import 'dotenv/config';
import { dbPromise } from './database.js';
import path from 'path'; 
import { fileURLToPath } from 'url'; 

// --- DATE CALCULATION UTILITY (CRITICAL for reminders) ---
function calculateNextDueDateSQL(lastCompletedDate, frequencyDays) {
    // Calculates the next due date based on the last completed date and frequency
    return `strftime('%Y-%m-%d', '${lastCompletedDate}', '+${frequencyDays} day')`;
}

// --- Path Setup for ES Modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); 

const app = express();
const PORT = process.env.PORT || 3000;
const saltRounds = 10; 

// --- API Keys from Environment Variables ---
const PLANT_ID_API_KEY = process.env.PLANT_ID_API_KEY;
const TREFLE_API_KEY = process.env.TREFLE_API_KEY;

// --- Database Connection ---
const db = await dbPromise.catch(err => {
    console.error("Critical: Database connection failed during server startup.", err);
    process.exit(1);
});

// --- Middleware ---
// Increased limit for potential base64 image data in /api/identify
app.use(express.json({ limit: '5mb' })); 
app.use(express.static(path.join(__dirname, '..', 'client'))); 

// Define the Root Route (/) to send the login page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'login.html'));
});

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 

    if (token == null) {
        return res.status(401).json({ message: "Access denied. No token provided." });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: "Invalid or expired token." });
        }
        req.user = user; 
        next();
    });
};


// ---------------------------------------------
// --- AUTHENTICATION ENDPOINTS ---
// ---------------------------------------------

// POST /api/register - User Registration
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password || password.length < 6) {
        return res.status(400).json({ message: "Email is required and password must be at least 6 characters." });
    }
    try {
        const existingUser = await db.get('SELECT user_id FROM users WHERE email = ?', [email]);
        if (existingUser) {
            return res.status(409).json({ message: "Error: A user with this email already exists." });
        }
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        await db.run(
            'INSERT INTO users (email, hashed_password) VALUES (?, ?)',
            [email, hashedPassword]
        );
        res.status(201).json({ message: "Registration successful! Redirecting to login." });
    } catch (error) {
        console.error("Server registration error:", error);
        res.status(500).json({ message: "An internal server error occurred." });
    }
});


// POST /api/login - User Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required." });
    }
    try {
        const user = await db.get('SELECT user_id, email, hashed_password FROM users WHERE email = ?', [email]);
        if (!user || !(await bcrypt.compare(password, user.hashed_password))) {
            return res.status(401).json({ message: "Invalid email or password." });
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


// ---------------------------------------------
// --- PLANT COLLECTION & IDENTIFICATION ENDPOINTS ---
// ---------------------------------------------

// POST /api/identify - Plant Identification API Submission 
app.post('/api/identify', authenticateToken, async (req, res) => {
    if (!PLANT_ID_API_KEY) {
        return res.status(500).json({ message: "PLANT_ID_API_KEY is missing from server environment." });
    }

    // The client should send the pure base64 string without the 'data:image/...' prefix
    const { base64Image } = req.body;
    if (!base64Image) {
        // This is the error message the client receives when the image is not converted/sent correctly
        return res.status(400).json({ message: "No image data provided for identification." });
    }

    try {
        const response = await fetch('https://plant.id/api/v2/identify', {
            method: 'POST',
            headers: {
                'Api-Key': PLANT_ID_API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                images: [base64Image], 
                details: ["common_names", "url", "wiki_description", "taxonomy", "edible_parts", "propagation_methods", "watering", "sunlight"],
            }),
        });

        const data = await response.json();
        
        if (response.ok) {
            // Success: Return the identification results
            res.status(200).json(data);
        } else {
            // Plant.ID API failed
            console.error("Plant.ID API Error:", data);
            res.status(response.status).json({ 
                message: data.detail || "External identification API failed." 
            });
        }
    } catch (error) {
        console.error("Network error during identification:", error);
        res.status(503).json({ message: "Could not connect to external identification service." });
    }
});

// GET /api/plant-details/:scientific_name - Fetch Supplemental Trefle Data 
app.get('/api/plant-details/:scientific_name', authenticateToken, async (req, res) => {
    if (!TREFLE_API_KEY) {
        return res.status(500).json({ message: "TREFLE_API_KEY is missing from server environment." });
    }
    
    const scientificName = req.params.scientific_name;
    if (!scientificName) {
        return res.status(400).json({ message: "Scientific name is required for detail lookup." });
    }

    try {
        // Trefle API Search endpoint: searches by scientific name
        const searchUrl = `https://trefle.io/api/v1/plants/search?token=${TREFLE_API_KEY}&q=${encodeURIComponent(scientificName)}`;
        let response = await fetch(searchUrl);
        let searchData = await response.json();

        if (response.ok && searchData.data && searchData.data.length > 0) {
            // Found a match: Now fetch the full details using the first result's Trefle ID
            const trefleId = searchData.data[0].id;
            const detailUrl = `https://trefle.io/api/v1/plants/${trefleId}?token=${TREFLE_API_KEY}`;
            
            response = await fetch(detailUrl);
            const detailData = await response.json();

            if (response.ok && detailData.data) {
                // Success: Return the rich detail data
                return res.status(200).json(detailData.data);
            }
        }
        
        // No match or API failed to return data
        res.status(404).json({ message: "Supplemental details not found on Trefle API." });

    } catch (error) {
        console.error("Network error fetching Trefle data:", error);
        res.status(503).json({ message: "Could not connect to external Trefle service." });
    }
});


// GET /api/plants - Fetch User's Plant Collection (Dashboard Load)
app.get('/api/plants', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id; 
        const plants = await db.all(
            'SELECT * FROM plants WHERE user_id = ? ORDER BY date_added DESC',
            [userId]
        );
        res.status(200).json(plants);
    } catch (error) {
        console.error("Error fetching user plants:", error);
        res.status(500).json({ message: "Failed to load plant collection." });
    }
});

// GET /api/plants/:id - Fetch a single plant's details (Plant Profile Load)
app.get('/api/plants/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const plantId = req.params.id;

        const plant = await db.get(
            'SELECT * FROM plants WHERE id = ? AND user_id = ?',
            [plantId, userId]
        );

        if (!plant) {
            return res.status(404).json({ message: "Plant not found or access denied." });
        }

        res.status(200).json(plant);

    } catch (error) {
        console.error("Error fetching single plant:", error);
        res.status(500).json({ message: "Failed to load plant details." });
    }
});

// POST /api/plants - Save Plant to User Collection
app.post('/api/plants', authenticateToken, async (req, res) => {
    const { name, scientific_name, common_name, image_url, notes, trefle_id, identification_data } = req.body;
    const userId = req.user.id;

    if (!name) {
        return res.status(400).json({ message: "Plant name is required." });
    }

    try {
        const result = await db.run(
            `INSERT INTO plants (user_id, name, scientific_name, common_name, image_url, notes, trefle_id, identification_data) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, name, scientific_name, common_name, image_url, notes, trefle_id, identification_data]
        );
        
        res.status(201).json({ 
            message: "Plant added successfully!", 
            plantId: result.lastID 
        });

    } catch (error) {
        console.error("Error saving plant:", error);
        res.status(500).json({ message: "Failed to save the new plant." });
    }
});

// PATCH /api/plants/:id - Update Plant Details
app.patch('/api/plants/:id', authenticateToken, async (req, res) => {
    const { name, scientific_name, common_name, notes, light_needs, last_watered, fertilizer_frequency } = req.body;
    const userId = req.user.id;
    const plantId = req.params.id;

    if (!name) {
        return res.status(400).json({ message: "Plant name is required for update." });
    }

    try {
        // This query allows selective updating of fields by providing a complex SET clause
        const result = await db.run(
            `UPDATE plants SET 
                name = COALESCE(?, name),
                scientific_name = COALESCE(?, scientific_name),
                common_name = COALESCE(?, common_name),
                notes = COALESCE(?, notes),
                light_needs = COALESCE(?, light_needs),
                last_watered = COALESCE(?, last_watered),
                fertilizer_frequency = COALESCE(?, fertilizer_frequency)
            WHERE id = ? AND user_id = ?`,
            [name, scientific_name, common_name, notes, light_needs, last_watered, fertilizer_frequency, plantId, userId]
        );

        if (result.changes === 0) {
            const exists = await db.get('SELECT id FROM plants WHERE id = ? AND user_id = ?', [plantId, userId]);
            if (!exists) {
                return res.status(404).json({ message: "Plant not found or access denied." });
            }
            return res.status(200).json({ message: "Plant details updated (no fields changed)." });
        }

        res.status(200).json({ message: "Plant details updated successfully." });

    } catch (error) {
        console.error("Error updating plant:", error);
        res.status(500).json({ message: "Failed to update plant." });
    }
});


// DELETE /api/plants/:id - Plant Deletion 
app.delete('/api/plants/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const plantId = req.params.id;

        const result = await db.run(
            'DELETE FROM plants WHERE id = ? AND user_id = ?',
            [plantId, userId]
        );

        if (result.changes === 0) {
            return res.status(404).json({ message: "Plant not found or access denied." });
        }

        // Optional: Also delete associated reminders and photos (good practice)
        await db.run('DELETE FROM reminders WHERE plant_id = ?', [plantId]);
        await db.run('DELETE FROM growth_photos WHERE plant_id = ?', [plantId]);

        res.status(200).json({ message: "Plant and all associated data deleted successfully." });

    } catch (error) {
        console.error("Error deleting plant:", error);
        res.status(500).json({ message: "Failed to delete plant." });
    }
});


// ---------------------------------------------
// --- REMINDERS/TASKS ENDPOINTS ---
// ---------------------------------------------

// POST /api/reminders - Create a new reminder
app.post('/api/reminders', authenticateToken, async (req, res) => {
    const { plant_id, type, frequency_days, last_completed } = req.body;
    const userId = req.user.id;

    if (!plant_id || !type || !frequency_days || !last_completed) {
        return res.status(400).json({ message: "Missing reminder fields (plant_id, type, frequency_days, last_completed)." });
    }

    try {
        // 1. Verify plant ownership (security check)
        const plant = await db.get('SELECT id FROM plants WHERE id = ? AND user_id = ?', [plant_id, userId]);
        if (!plant) {
            return res.status(404).json({ message: "Plant not found or access denied." });
        }

        // 2. Calculate next_due date
        const nextDueDateSQL = calculateNextDueDateSQL(last_completed, frequency_days);

        // 3. Insert the reminder
        const result = await db.run(
            `INSERT INTO reminders (plant_id, type, frequency_days, last_completed, next_due) 
             VALUES (?, ?, ?, ?, ${nextDueDateSQL})`,
            [plant_id, type, frequency_days, last_completed]
        );
        
        res.status(201).json({ 
            message: "Reminder set successfully!", 
            reminderId: result.lastID 
        });

    } catch (error) {
        console.error("Error setting reminder:", error);
        res.status(500).json({ message: "Failed to set reminder." });
    }
});

// GET /api/plants/:id/reminders - Fetch all reminders for a specific plant
app.get('/api/plants/:id/reminders', authenticateToken, async (req, res) => {
    const plantId = req.params.id;
    const userId = req.user.id;

    try {
        // Check plant ownership and fetch reminders in one query
        const reminders = await db.all(`
            SELECT r.*
            FROM reminders r
            JOIN plants p ON r.plant_id = p.id
            WHERE r.plant_id = ? AND p.user_id = ?
            ORDER BY r.next_due ASC
        `, [plantId, userId]);

        res.status(200).json(reminders);
    } catch (error) {
        console.error("Error fetching plant reminders:", error);
        res.status(500).json({ message: "Failed to load plant reminders." });
    }
});

// DELETE /api/reminders/:id - Delete a specific reminder
app.delete('/api/reminders/:id', authenticateToken, async (req, res) => {
    const reminderId = req.params.id;
    const userId = req.user.id;

    try {
        // Check ownership and delete in one go
        const result = await db.run(`
            DELETE FROM reminders 
            WHERE id = ? 
            AND plant_id IN (SELECT id FROM plants WHERE user_id = ?)
        `, [reminderId, userId]);

        if (result.changes === 0) {
            return res.status(404).json({ message: "Reminder not found or access denied." });
        }

        res.status(200).json({ message: "Reminder deleted successfully." });
    } catch (error) {
        console.error("Error deleting reminder:", error);
        res.status(500).json({ message: "Failed to delete reminder." });
    }
});


// POST /api/reminders/:id/complete - Reminder Completion 
app.post('/api/reminders/:id/complete', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const reminderId = req.params.id;
        const todayDate = new Date().toISOString().split('T')[0];

        // 1. Get the reminder's details (frequency) and ensure it belongs to the user's plant
        const reminder = await db.get(`
            SELECT r.frequency_days 
            FROM reminders r
            JOIN plants p ON r.plant_id = p.id
            WHERE r.id = ? AND p.user_id = ?
        `, [reminderId, userId]);

        if (!reminder) {
            return res.status(404).json({ message: "Reminder not found or access denied." });
        }

        const nextDueDateSQL = calculateNextDueDateSQL(todayDate, reminder.frequency_days);

        // 2. Update the reminder
        const result = await db.run(
            `UPDATE reminders 
             SET last_completed = ?, 
                 next_due = ${nextDueDateSQL}
             WHERE id = ?`,
            [todayDate, reminderId]
        );

        if (result.changes === 0) {
             return res.status(404).json({ message: "Failed to update reminder (no changes made)." });
        }

        res.status(200).json({ message: "Reminder completed and next due date updated." });

    } catch (error) {
        console.error("Error completing reminder:", error);
        res.status(500).json({ message: "Failed to complete task." });
    }
});

// GET /api/reminders/due - Fetch all reminders that are due today or overdue
app.get('/api/reminders/due', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const todayDate = new Date().toISOString().split('T')[0];

        const reminders = await db.all(`
            SELECT 
                r.id AS reminder_id, 
                r.plant_id, 
                r.type, 
                r.next_due, 
                r.frequency_days,
                p.name AS plant_name 
            FROM reminders r
            JOIN plants p ON r.plant_id = p.id
            WHERE p.user_id = ? 
              AND r.next_due <= ?
            ORDER BY r.next_due ASC
        `, [userId, todayDate]);

        res.status(200).json(reminders);

    } catch (error) {
        console.error("Error fetching due reminders:", error);
        res.status(500).json({ message: "Failed to load reminders." });
    }
});

// ---------------------------------------------
// --- GROWTH PHOTO ENDPOINTS ---
// ---------------------------------------------

// POST /api/plants/:id/photos - Add a new growth photo
app.post('/api/plants/:id/photos', authenticateToken, async (req, res) => {
    const plantId = req.params.id;
    // Client should send the Base64 image data as image_url for storage
    const { image_url, notes } = req.body; 
    const userId = req.user.id;
    const date_taken = new Date().toISOString().split('T')[0];

    if (!image_url) {
        return res.status(400).json({ message: "Image data is required." });
    }

    try {
        // 1. Verify plant ownership (security check)
        const plant = await db.get('SELECT id FROM plants WHERE id = ? AND user_id = ?', [plantId, userId]);
        if (!plant) {
            return res.status(404).json({ message: "Plant not found or access denied." });
        }

        // 2. Insert the photo record
        const result = await db.run(
            `INSERT INTO growth_photos (plant_id, image_url, date_taken, notes) 
             VALUES (?, ?, ?, ?)`,
            [plantId, image_url, date_taken, notes]
        );
        
        res.status(201).json({ 
            message: "Photo added successfully!", 
            photoId: result.lastID 
        });

    } catch (error) {
        console.error("Error adding photo:", error);
        res.status(500).json({ message: "Failed to add photo." });
    }
});

// GET /api/plants/:id/photos - Fetch all growth photos for a specific plant
app.get('/api/plants/:id/photos', authenticateToken, async (req, res) => {
    const plantId = req.params.id;
    const userId = req.user.id;

    try {
        // Check plant ownership and fetch photos in one query
        const photos = await db.all(`
            SELECT gp.*
            FROM growth_photos gp
            JOIN plants p ON gp.plant_id = p.id
            WHERE gp.plant_id = ? AND p.user_id = ?
            ORDER BY gp.date_taken DESC
        `, [plantId, userId]);

        res.status(200).json(photos);
    } catch (error) {
        console.error("Error fetching plant photos:", error);
        res.status(500).json({ message: "Failed to load plant photos." });
    }
});


// --- Server Start ---
app.listen(PORT, () => {
    console.log(`\nServer is running on http://localhost:${PORT}`);
    console.log(`Access login page at: http://localhost:${PORT}/login.html\n`);
});