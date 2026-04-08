/**
 * Phase 1B — analytics router (GET /dashboard, GET /team under /analytics).
 * Director dashboard stays registered separately after app.listen (parity with server.js order).
 */
const express = require('express');
const { createAnalyticsHandlers } = require('../services/analytics.service');

function createAnalyticsRouter(deps) {
  const { authenticateToken } = deps;
  const handlers = createAnalyticsHandlers(deps);
  const router = express.Router();
  router.get('/dashboard', authenticateToken, handlers.getDashboard);
  router.get('/team', authenticateToken, handlers.getTeam);
  return router;
}

function registerDirectorDashboardRoute(app, deps) {
  const { authenticateToken } = deps;
  const { getDirectorDashboard } = createAnalyticsHandlers(deps);
  app.get('/analytics/director-dashboard', authenticateToken, getDirectorDashboard);
}

module.exports = { createAnalyticsRouter, registerDirectorDashboardRoute };
