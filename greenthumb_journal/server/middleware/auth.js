// server/middleware/auth.js
const jwt = require('jsonwebtoken');

/**
 * Middleware function to protect routes.
 * It verifies the JWT token present in the Authorization header.
 *
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
const protect = (req, res, next) => {
    let token;

    // 1. Check if the token is present in the headers
    // The token is typically sent as 'Bearer TOKEN_STRING'
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Extract the token part: 'Bearer' [0], 'TOKEN_STRING' [1]
            token = req.headers.authorization.split(' ')[1];

            // 2. Verify the token using the secret key
            // NOTE: process.env.JWT_SECRET must be defined in your .env file
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // 3. Attach the decoded user ID to the request object
            // This makes the user ID available in the route handlers (e.g., req.user.id)
            req.user = {
                id: decoded.id
                // We typically fetch the full user object here in production,
                // but for this project, the ID is sufficient for authorization.
            };

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

module.exports = { protect };