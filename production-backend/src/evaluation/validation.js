/**
 * Phase 2A — evaluation create validation (item scores, non-empty items).
 * Parity: same messages, errors, and fields as previous inline logic.
 */

function validateEvaluationItemsForCreate(body) {
  if (!body.items || body.items.length === 0) {
    return {
      ok: false,
      response: {
        message: 'Evaluation must contain at least one item with a valid score (1-4)',
        error: 'INVALID_EVALUATION_DATA',
      },
    };
  }

  for (let i = 0; i < body.items.length; i++) {
    const item = body.items[i];
    const score = item.rating || item.score;

    if (!score || score < 1 || score > 4) {
      return {
        ok: false,
        response: {
          message: `All evaluation items must have a valid score between 1 and 4. Item ${item.behaviorItemId} has invalid score: ${score}`,
          error: 'INVALID_SCORE',
          itemId: item.behaviorItemId,
          score: score,
        },
      };
    }
  }

  return { ok: true };
}

module.exports = { validateEvaluationItemsForCreate };
