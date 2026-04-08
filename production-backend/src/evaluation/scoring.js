/**
 * Phase 2A — overall score calculation (moved verbatim from evaluations.service.js).
 */

function calculateOverallScore(items, scoringProfile = { mode: 'legacy_average', settings: {} }, featureFlags = { enableCompanyCustomization: false, useLegacyEvaluationFlow: true }) {
  if (!items || items.length === 0) return null; // Return null instead of 0 for invalid data
  const validItems = items.filter(item => {
    const score = item.rating || item.score;
    return score && score >= 1 && score <= 4;
  });
  if (validItems.length === 0) return null; // No valid items

  const canUseCustomScoring =
    featureFlags?.enableCompanyCustomization === true &&
    featureFlags?.useLegacyEvaluationFlow === false &&
    scoringProfile?.mode === 'weighted_average';

  if (canUseCustomScoring) {
    const weightsByBehaviorItemId = scoringProfile?.settings?.weightsByBehaviorItemId || {};
    const weighted = validItems.reduce((acc, item) => {
      const score = item.rating || item.score;
      const weight = Number(weightsByBehaviorItemId[item.behaviorItemId] ?? 1);
      return {
        totalWeight: acc.totalWeight + (Number.isFinite(weight) && weight > 0 ? weight : 1),
        weightedScore: acc.weightedScore + score * (Number.isFinite(weight) && weight > 0 ? weight : 1)
      };
    }, { totalWeight: 0, weightedScore: 0 });
    if (weighted.totalWeight > 0) {
      return Math.round((weighted.weightedScore / weighted.totalWeight) * 100) / 100;
    }
  }

  const totalScore = validItems.reduce((sum, item) => sum + (item.rating || item.score), 0);
  return Math.round((totalScore / validItems.length) * 100) / 100;
}

/**
 * Returns the same 400 body as the previous inline check, or null if overallScore is acceptable.
 */
function getInvalidOverallScoreResponse(overallScore) {
  if (!overallScore || overallScore < 1 || overallScore > 4) {
    return {
      message: 'Failed to calculate overall score. Please ensure all items have valid scores between 1 and 4.',
      error: 'INVALID_OVERALL_SCORE',
      calculatedScore: overallScore
    };
  }
  return null;
}

module.exports = { calculateOverallScore, getInvalidOverallScoreResponse };
