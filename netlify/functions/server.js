import express from 'express';
// --- IMPORTANT: Use the 'netlify' adapter for Express ---
import serverless from 'serverless-http'; 
import bcrypt from 'bcrypt'; 
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import 'dotenv/config'; 
import { dbPromise } from './database.js';

// --- DATE CALCULATION UTILITY (WEEK 7) ---

/**
 * Calculates the next due date using SQLite's datetime functions.
 * @param {string} lastCompletedDate - The last date the task was completed (YYYY-MM-DD).
 * @param {number} frequencyDays - The interval in days (e.g., 7).
 * @returns {string} SQLite function string to calculate the date.
 */
function calculateNextDueDateSQL(lastCompletedDate, frequencyDays) {
    // Note: The sqlite date function uses 'day' for days, 'month' for months, etc.
    return `strftime('%Y-%m-%d', '${lastCompletedDate}', '+${frequencyDays} day')`;
}

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

// --- Authentication Middleware (WEEK 6) ---
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

// POST /api/register - User Registration (WEEK 5)
app.post('/api/register', async (req, res) => {
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


// POST /api/login - User Login (WEEK 6)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required." });
    }

    try {
        const user = await db.get('SELECT user_id, email, hashed_password FROM users WHERE email = ?', [email]);
        
        if (!user) {
            return res.status(401).json({ message: "Invalid email or password. (User Not Found)" });
        }

        const match = await bcrypt.compare(password, user.hashed_password);

        if (!match) {
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


// POST /api/identify - Plant Identification API Submission (WEEK 6)
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

        // Handle non-JSON API errors gracefully
        if (!response.ok) {
            const errorText = await response.text();
            
            console.error(`Plant ID API Error (Status ${response.status}):`, errorText.substring(0, 100)); 
            
            let message = "Error communicating with the plant identification service.";
            
            try {
                const errorData = JSON.parse(errorText);
                message = errorData.detail || message;
            } catch (e) {
                message = `API Key Issue or unexpected response.`;
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


// GET /api/plant-details/:scientific_name - Fetch Supplemental Trefle Data (WEEK 6)
app.get('/api/plant-details/:scientific_name', authenticateToken, async (req, res) => { 
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


// POST /api/plants - Save Plant to User Collection (WEEK 6, updated for diagnosis data)
app.post('/api/plants', authenticateToken, async (req, res) => {
    const { name, scientific_name, common_name, image_url, notes, identification_data } = req.body;
    const user_id = req.user.id;

    if (!name || !user_id) {
        return res.status(400).json({ message: "Plant name and user ID are required." });
    }

    try {
        // Storing identification_data (which includes diagnosis info) as JSON string
        const result = await db.run(
            'INSERT INTO plants (user_id, name, scientific_name, common_name, image_url, notes, identification_data) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [user_id, name, scientific_name, common_name, image_url || null, notes || null, JSON.stringify(identification_data) || null]
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


// GET /api/plants - Fetch User's Plant Collection (WEEK 6)
app.get('/api/plants', authenticateToken, async (req, res) => {
    const user_id = req.user.id;
    try {
        const plants = await db.all('SELECT * FROM plants WHERE user_id = ? ORDER BY date_added DESC', user_id);
        
        // Ensure identification_data is parsed back into JSON for the client
        const plantsWithParsedData = plants.map(p => ({
            ...p,
            identification_data: p.identification_data ? JSON.parse(p.identification_data) : null
        }));
        res.status(200).json(plantsWithParsedData);
    } catch (error) {
        console.error("Error fetching plants:", error);
        res.status(500).json({ message: "Failed to retrieve user's plant collection." });
    }
});


// GET /api/plants/:id - Fetch Detailed Plant Profile View (WEEK 6, updated for diagnosis data)
app.get('/api/plants/:id', authenticateToken, async (req, res) => {
    const plant_id = req.params.id;
    const user_id = req.user.id;
    try {
        const plant = await db.get('SELECT * FROM plants WHERE id = ? AND user_id = ?', [plant_id, user_id]);
        if (!plant) {
            return res.status(404).json({ message: "Plant not found or does not belong to user." });
        }
        
        // Ensure identification_data is parsed back into JSON for the client
        const plantWithParsedData = {
            ...plant,
            identification_data: plant.identification_data ? JSON.parse(plant.identification_data) : null
        };
        res.status(200).json(plantWithParsedData);
    } catch (error) {
        console.error("Error fetching single plant:", error);
        res.status(500).json({ message: "Failed to retrieve plant details." });
    }
});


// ----------------------------------------------------------------------
// --- PLANT MANAGEMENT CRUD (WEEK 7) ---
// ----------------------------------------------------------------------

// PATCH /api/plants/:id - Update Plant Details (WEEK 7: Editing)
app.patch('/api/plants/:id', authenticateToken, async (req, res) => {
    const plant_id = req.params.id;
    const user_id = req.user.id;
    const { name, scientific_name, common_name, notes } = req.body;

    let fields = [];
    let params = [];

    if (name) { fields.push('name = ?'); params.push(name); }
    // Note: Scientific name and Common name can be NULL (empty string '' in form should be treated as NULL/no update)
    if (scientific_name !== undefined) { fields.push('scientific_name = ?'); params.push(scientific_name || null); }
    if (common_name !== undefined) { fields.push('common_name = ?'); params.push(common_name || null); }
    if (notes !== undefined) { fields.push('notes = ?'); params.push(notes || null); }
    
    if (fields.length === 0) {
        return res.status(400).json({ message: "No fields provided for update." });
    }

    params.push(plant_id, user_id);
    const sql = `UPDATE plants SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`;

    try {
        const result = await db.run(sql, params);
        
        if (result.changes === 0) {
            return res.status(404).json({ message: "Plant not found or not owned by user." });
        }

        res.status(200).json({ message: "Plant details successfully updated." });

    } catch (error) {
        console.error("Error updating plant:", error);
        res.status(500).json({ message: "Failed to update plant details." });
    }
});


// POST /api/plants/:id/photos - Save Growth Photo Record (WEEK 7: Photo Upload)
app.post('/api/plants/:id/photos', authenticateToken, async (req, res) => {
    const plant_id = req.params.id;
    const { image_url, notes } = req.body;
    const user_id = req.user.id;

    if (!image_url) {
        return res.status(400).json({ message: "Image URL is required." });
    }

    try {
        // 1. Verify the plant belongs to the user
        const plant = await db.get('SELECT user_id FROM plants WHERE id = ?', [plant_id]);
        if (!plant || plant.user_id !== user_id) {
            return res.status(403).json({ message: "Unauthorized access to plant." });
        }
        
        // 2. Insert the new photo record
        const result = await db.run(
            'INSERT INTO growth_photos (plant_id, image_url, notes) VALUES (?, ?, ?)',
            [plant_id, image_url, notes || null]
        );

        res.status(201).json({ 
            message: "Growth photo saved.",
            photo_id: result.lastID
        });

    } catch (error) {
        console.error("Error saving growth photo:", error);
        res.status(500).json({ message: "Failed to save the photo record." });
    }
});


// GET /api/plants/:id/photos - Fetch all growth photos for a plant (WEEK 7: NEW ROUTE)
app.get('/api/plants/:id/photos', authenticateToken, async (req, res) => {
    const plant_id = req.params.id;
    const user_id = req.user.id;
    
    try {
        // Security check: Verify the plant belongs to the user
        const plant = await db.get('SELECT user_id FROM plants WHERE id = ?', [plant_id]);
        if (!plant || plant.user_id !== user_id) {
            return res.status(403).json({ message: "Unauthorized access to plant photos." });
        }

        const photos = await db.all(
            `SELECT id, image_url, date_taken, notes 
            FROM growth_photos 
            WHERE plant_id = ? 
            ORDER BY date_taken DESC`,
            [plant_id]
        );

        res.status(200).json(photos);

    } catch (error) {
        console.error("Error fetching growth photos:", error);
        res.status(500).json({ message: "Failed to retrieve growth photos." });
    }
});


// DELETE /api/plants/:id - Implement Plant Deletion Functionality (WEEK 6)
app.delete('/api/plants/:id', authenticateToken, async (req, res) => {
    const plant_id = req.params.id;
    const user_id = req.user.id;
    try {
        // Database should handle CASCADE DELETE for related records (reminders, photos)
        const result = await db.run('DELETE FROM plants WHERE id = ? AND user_id = ?', [plant_id, user_id]);
        if (result.changes === 0) {
            return res.status(404).json({ message: "Plant not found or could not be deleted." });
        }
        res.status(200).json({ message: "Plant successfully deleted." });
    } catch (error) {
        console.error("Error deleting plant:", error);
        res.status(500).json({ message: "Failed to delete the plant." });
    }
});


// ----------------------------------------------------------------------
// --- SCHEDULING & REMINDER ENDPOINTS (WEEK 7) ---
// ----------------------------------------------------------------------

// POST /api/reminders - Set a new reminder (WEEK 7: Create Reminder)
app.post('/api/reminders', authenticateToken, async (req, res) => {
    const { plant_id, type, frequency_days, last_completed } = req.body;
    const user_id = req.user.id;

    if (!plant_id || !type || !frequency_days) {
        return res.status(400).json({ message: "Plant ID, type, and frequency are required." });
    }
    if (typeof frequency_days !== 'number' || frequency_days <= 0) {
        return res.status(400).json({ message: "Frequency must be a positive number of days." });
    }

    try {
        // 1. Verify the plant belongs to the user
        const plant = await db.get('SELECT user_id FROM plants WHERE id = ?', [plant_id]);
        if (!plant || plant.user_id !== user_id) {
            return res.status(403).json({ message: "Unauthorized access to plant." });
        }

        // 2. Calculate the initial next_due date
        const initialLastCompleted = last_completed || (new Date().toISOString().split('T')[0]);
        const nextDueDateSQL = calculateNextDueDateSQL(initialLastCompleted, frequency_days);

        // 3. Insert the new reminder
        const result = await db.run(
            `INSERT INTO reminders 
            (plant_id, type, frequency_days, last_completed, next_due) 
            VALUES (?, ?, ?, ?, ${nextDueDateSQL})`,
            [plant_id, type, frequency_days, initialLastCompleted]
        );

        res.status(201).json({ 
            message: "Reminder successfully set.",
            reminder_id: result.lastID
        });

    } catch (error) {
        console.error("Error setting reminder:", error);
        res.status(500).json({ message: "Failed to set the reminder." });
    }
});


// GET /api/reminders/due - Fetch tasks due today or overdue (WEEK 7: Today's Tasks Widget)
app.get('/api/reminders/due', authenticateToken, async (req, res) => {
    const user_id = req.user.id;
    
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const dueReminders = await db.all(
            `SELECT 
                r.id AS reminder_id, 
                r.plant_id, 
                r.type, 
                r.frequency_days, 
                r.next_due, 
                p.name AS plant_name,
                p.image_url
            FROM reminders r
            JOIN plants p ON r.plant_id = p.id
            WHERE p.user_id = ? AND r.next_due <= ? 
            ORDER BY r.next_due ASC`,
            [user_id, today]
        );

        res.status(200).json(dueReminders);

    } catch (error) {
        console.error("Error fetching due reminders:", error);
        res.status(500).json({ message: "Failed to retrieve today's tasks." });
    }
});


// POST /api/reminders/:id/complete - Log event and update next due date (WEEK 7: Log Event)
app.post('/api/reminders/:id/complete', authenticateToken, async (req, res) => {
    const reminder_id = req.params.id;
    const user_id = req.user.id;
    const completionDate = new Date().toISOString().split('T')[0];

    try {
        const reminder = await db.get(
            `SELECT 
                r.frequency_days, p.user_id 
            FROM reminders r
            JOIN plants p ON r.plant_id = p.id
            WHERE r.id = ?`,
            [reminder_id]
        );

        if (!reminder || reminder.user_id !== user_id) {
            return res.status(403).json({ message: "Unauthorized or reminder not found." });
        }

        // Calculate the new next_due date
        const nextDueDateSQL = calculateNextDueDateSQL(completionDate, reminder.frequency_days);

        // Update the reminder record
        await db.run(
            `UPDATE reminders 
            SET last_completed = ?, 
                next_due = ${nextDueDateSQL} 
            WHERE id = ?`,
            [completionDate, reminder_id]
        );

        res.status(200).json({ 
            message: "Task completed. Next due date calculated.",
        });

    } catch (error) {
        console.error("Error completing task:", error);
        res.status(500).json({ message: "Failed to log task completion." });
    }
});


// GET /api/plants/:id/reminders - Fetch all reminders for a specific plant (WEEK 7)
app.get('/api/plants/:id/reminders', authenticateToken, async (req, res) => {
    const plant_id = req.params.id;
    const user_id = req.user.id;
    
    try {
        const plant = await db.get('SELECT user_id FROM plants WHERE id = ?', [plant_id]);
        if (!plant || plant.user_id !== user_id) {
            return res.status(403).json({ message: "Unauthorized access to plant." });
        }

        const reminders = await db.all(
            `SELECT * FROM reminders 
            WHERE plant_id = ? 
            ORDER BY next_due ASC, type ASC`,
            [plant_id]
        );

        res.status(200).json(reminders);

    } catch (error) {
        console.error("Error fetching plant reminders:", error);
        res.status(500).json({ message: "Failed to retrieve plant reminders." });
    }
});


// DELETE /api/reminders/:id - Delete a specific reminder (WEEK 7)
app.delete('/api/reminders/:id', authenticateToken, async (req, res) => {
    const reminder_id = req.params.id;
    const user_id = req.user.id;
    
    try {
        // Ensure the user owns the plant associated with the reminder before deleting
        const result = await db.run(
            `DELETE FROM reminders 
            WHERE id = ? 
            AND plant_id IN (SELECT id FROM plants WHERE user_id = ?)`,
            [reminder_id, user_id]
        );

        if (result.changes === 0) {
            return res.status(404).json({ message: "Reminder not found or unauthorized." });
        }

        res.status(200).json({ message: "Reminder successfully deleted." });

    } catch (error) {
        console.error("Error deleting reminder:", error);
        res.status(500).json({ message: "Failed to delete the reminder." });
    }
});


// Export the handler for Netlify (CRITICAL)
export const handler = serverless(app);