/**
 * Phase 1A — Express error middleware hook.
 * Forwards all errors to the default Express handler (no response shaping in Phase 1A).
 */
function forwardErrorToExpressDefault(err, req, res, next) {
  next(err);
}

module.exports = { forwardErrorToExpressDefault };
