// auth.js
const bcrypt = require('bcryptjs');

// Users database (username: hashed_password)
// Default password: admin123
const USERS = {
    'admin': '$2b$10$03okGancnbTHaRn9L9ascOjazNq1t4PSdcVizpTrfxL8/a4oO5r.S'
};

/**
 * Verify username and password
 */
function verifyPassword(username, password) {
    const hashedPassword = USERS[username];
    if (!hashedPassword) {
        return false;
    }
    return bcrypt.compareSync(password, hashedPassword);
}

/**
 * Middleware to require authentication
 */
function requireAuth(req, res, next) {
    if (req.session && req.session.authenticated) {
        return next();
    }

    // For API calls, return 401
    if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // For page requests, redirect to login
    res.redirect('/login');
}

/**
 * Generate password hash (for adding new users)
 */
function generateHash(password) {
    return bcrypt.hashSync(password, 10);
}

module.exports = {
    verifyPassword,
    requireAuth,
    generateHash,
    USERS
};
