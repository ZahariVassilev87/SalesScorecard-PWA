/**
 * Phase 2A — overall score calculation (moved verbatim from evaluations.service.js).
 * Pinned structure — excludes N/A sections; formulas unchanged on applicable items only.
 */

const { buildPinnedStructureIndex } = require('./validation');

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
 * Overall score from only items whose section is not marked N/A in sectionOverrides.
 * Same averaging logic as calculateOverallScore on the filtered list.
 */
function calculateOverallScoreForPinnedStructure(
  items,
  evaluationStructure,
  sectionOverrides,
  scoringProfile = { mode: 'legacy_average', settings: {} },
  featureFlags = { enableCompanyCustomization: false, useLegacyEvaluationFlow: true }
) {
  const { behaviorToSection } = buildPinnedStructureIndex(evaluationStructure);
  const na = sectionOverrides && typeof sectionOverrides === 'object' && !Array.isArray(sectionOverrides) ? sectionOverrides : {};
  const naSections = new Set();
  for (const [sid, v] of Object.entries(na)) {
    if (v && v.notApplicable === true) naSections.add(sid);
  }

  const applicableItems = (items || []).filter((it) => {
    const bid = String(it.behaviorItemId || '').trim();
    const sec = behaviorToSection.get(bid);
    if (!sec) return false;
    return !naSections.has(sec);
  });

  return calculateOverallScore(applicableItems, scoringProfile, featureFlags);
}

/**
 * @param {number|null|undefined} overallScore
 * @param {{ allowNullOverall?: boolean }} [options]
 */
function getInvalidOverallScoreResponse(overallScore, options = {}) {
  const allowNull = options.allowNullOverall === true;
  if (overallScore === null || overallScore === undefined) {
    if (allowNull) return null;
    return {
      message: 'Failed to calculate overall score. Please ensure all items have valid scores between 1 and 4.',
      error: 'INVALID_OVERALL_SCORE',
      calculatedScore: overallScore
    };
  }
  if (overallScore < 1 || overallScore > 4) {
    return {
      message: 'Failed to calculate overall score. Please ensure all items have valid scores between 1 and 4.',
      error: 'INVALID_OVERALL_SCORE',
      calculatedScore: overallScore
    };
  }
  return null;
}

module.exports = { calculateOverallScore, calculateOverallScoreForPinnedStructure, getInvalidOverallScoreResponse };
