/**
 * Phase 1B — evaluations router (paths unchanged: POST /evaluations, GET /evaluations/my).
 */
const express = require('express');
const { createEvaluationsHandlers } = require('../services/evaluations.service');

function createEvaluationsRouter(deps) {
  const { authenticateToken, authorizeEvaluationCreation } = deps;
  const { postEvaluation, getMyEvaluations } = createEvaluationsHandlers(deps);
  const router = express.Router();
  router.post('/', authenticateToken, authorizeEvaluationCreation, postEvaluation);
  router.get('/my', authenticateToken, getMyEvaluations);
  return router;
}

module.exports = createEvaluationsRouter;
