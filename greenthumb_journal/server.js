// server.js (Main Express Server File)
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors'); // Use cors if you run the client and server on different ports

const app = express();
const PORT = 3000; // Choose your preferred port

// --- Middleware Setup ---
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the 'client' directory (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '../client')));

// --- Route Definitions ---

// Import and use authentication routes
const authRoutes = require('./routes/auth'); 
app.use('/api/auth', authRoutes);

// Import and use main plant routes
const plantRoutes = require('./routes/plants'); 
app.use('/api/plants', plantRoutes);

// Import and use reminders routes (if you choose to separate them)
const reminderRoutes = require('./routes/reminders'); 
app.use('/api/reminders', reminderRoutes);

// Fallback for root path to serve the entry page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/login.html'));
});


// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});