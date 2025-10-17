// netlify/functions/auth.js (The combined authentication helper module)

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt'); // Needed for password hashing
require('dotenv').config(); // Ensure environment variables are loaded (for JWT_SECRET)

// --- CONFIGURATION ---
// Set your environment variables (e.g., in Netlify UI or local .env)
const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret_key';
const SALT_ROUNDS = 10; // Standard security practice

// --- 1. PASSWORD HASHING/VERIFICATION HELPERS ---

/**
 * Hashes a plaintext password for storage.
 * @param {string} password - The user's plaintext password.
 * @returns {Promise<string>} The hashed password string.
 */
async function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compares a plaintext password with a stored hash.
 * @param {string} password - The user's plaintext password.
 * @param {string} hash - The stored hashed password.
 * @returns {Promise<boolean>} True if passwords match, false otherwise.
 */
async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

// --- 2. TOKEN GENERATION HELPER ---

/**
 * Generates a JSON Web Token (JWT) for the user.
 * @param {number} userId - The ID of the user to encode in the token.
 * @returns {string} The signed JWT token.
 */
function generateToken(userId) {
    // The payload uses 'id' to match the 'decoded.id' used in the protect middleware
    return jwt.sign({ id: userId }, JWT_SECRET, {
        expiresIn: '7d' // Token expires in 7 days
    });
}

// --- 3. AUTHENTICATION MIDDLEWARE ---

/**
 * Middleware function to protect routes. Verifies the JWT token.
 * We rename 'protect' to 'authCheck' for clarity in Express usage.
 */
const authCheck = (req, res, next) => {
    // NOTE: This logic should ideally be applied *after* dbCheck
    let token;

    // 1. Check if the token is present in the headers ('Bearer TOKEN_STRING')
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            
            // 2. Verify the token using the secret key
            const decoded = jwt.verify(token, JWT_SECRET);

            // 3. Attach the decoded user ID to the request object (req.userId is common)
            req.userId = decoded.id; 

            // Continue to the next middleware or the route handler
            next();

        } catch (error) {
            console.error('Token verification failed:', error.message);
            // If verification fails (expired, invalid signature), send a 401 response
            return res.status(401).json({ message: 'Not authorized, token failed or expired.' });
        }
    }

    // 4. Handle case where no token is provided
    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token.' });
    }
};

module.exports = { 
    hashPassword, 
    verifyPassword, 
    generateToken, 
    authCheck 
};