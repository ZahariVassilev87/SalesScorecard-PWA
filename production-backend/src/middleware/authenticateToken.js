/**
 * Phase 1A — JWT bearer authentication (parity with previous server.js).
 */
const jwt = require('jsonwebtoken');

function createAuthenticateToken({ jwtSecret, defaultCompanyId }) {
  return function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided', error: 'Unauthorized', statusCode: 401 });
    }

    jwt.verify(token, jwtSecret, (err, user) => {
      if (err) {
        console.log('Token verification failed:', err.message);
        return res.status(403).json({ message: 'Forbidden', statusCode: 403 });
      }
      req.user = {
        ...user,
        companyId: user.companyId || defaultCompanyId,
      };
      next();
    });
  };
}

module.exports = { createAuthenticateToken };
