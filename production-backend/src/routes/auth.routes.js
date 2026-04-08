/**
 * Phase 1B — auth router (paths unchanged: /auth/login, /auth/refresh, /auth/logout).
 */
const express = require('express');
const { createAuthHandlers } = require('../services/auth.service');

function createAuthRouter(deps) {
  const handlers = createAuthHandlers(deps);
  const router = express.Router();
  router.post('/login', handlers.login);
  router.post('/refresh', handlers.refresh);
  router.post('/logout', handlers.logout);
  return router;
}

module.exports = createAuthRouter;
