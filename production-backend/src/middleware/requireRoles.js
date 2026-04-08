/**
 * Phase 1A — role guards (parity with previous server.js).
 */

function authorizeEvaluationCreation(req, res, next) {
  const userRole = req.user.role;
  const allowedRoles = ['ADMIN', 'SALES_DIRECTOR', 'REGIONAL_SALES_MANAGER', 'REGIONAL_MANAGER', 'SALES_LEAD'];

  if (!allowedRoles.includes(userRole)) {
    return res.status(403).json({
      message: 'Insufficient permissions to create evaluations',
      statusCode: 403,
    });
  }

  next();
}

module.exports = { authorizeEvaluationCreation };
