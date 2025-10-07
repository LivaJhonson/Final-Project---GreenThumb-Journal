import express from 'express';
import bcrypt from 'bcrypt'; 
import 'dotenv/config';
import { dbPromise } from './database.js'; 
import path from 'path'; // <-- NEW: Import path module
import { fileURLToPath } from 'url'; // <-- NEW: Required for __dirname with 'import'

// --- Path Setup for ES Modules ---
// We need these two lines to correctly define __dirname for absolute path resolving in Node.js ES Modules.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); 
// Note: __dirname now points to the /server directory.

const app = express();
const PORT = process.env.PORT || 3000;
const saltRounds = 10; 

// --- Middleware ---
app.use(express.json()); 

// 1. Serve Static Files (HTML, CSS, JS)
// We use path.join(__dirname, '..', 'client') to reliably go up one level (from /server to root) 
// and then into the /client folder. This makes the path absolute and reliable.
app.use(express.static(path.join(__dirname, '..', 'client'))); 


// 2. Define the Root Route (/) to send the login page
app.get('/', (req, res) => {
    // We explicitly send the login.html file from the /client folder
    res.sendFile(path.join(__dirname, '..', 'client', 'login.html'));
});


// --- Database Connection ---
let db;
dbPromise.then(instance => {
    db = instance;
}).catch(err => {
    console.error("Critical: Database connection failed during server startup.", err);
    process.exit(1);
});


// --- API Endpoints ---

// Task: Write API Endpoint: User Registration
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password || password.length < 6) {
        return res.status(400).json({ message: "Email is required and password must be at least 6 characters." });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);

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

// Task: Write API Endpoint: User Login/Logout (Placeholder for Week 5)
app.post('/api/login', async (req, res) => {
    res.status(501).json({ message: "Login authentication is currently under development (Week 6 goal)." }); 
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});