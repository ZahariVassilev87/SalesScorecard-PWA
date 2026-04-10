/**
 * Phase 2A — evaluation create validation (item scores, non-empty items).
 * Pinned structure path — cluster-level N/A (sectionOverrides), strict item/section matching.
 */

/**
 * Legacy create: at least one item, each score 1–4.
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

function failResponse(message, error, extra = {}) {
  return {
    ok: false,
    response: {
      message,
      error,
      ...extra,
    },
  };
}

/**
 * Build ordered section ids and expected behaviorItemIds per section from pinned evaluationStructure.
 * @returns {{ sectionIds: string[], expectedBehaviorIdsBySection: Map<string, string[]>, behaviorToSection: Map<string, string> }}
 */
function buildPinnedStructureIndex(evaluationStructure) {
  const sections = Array.isArray(evaluationStructure?.sections) ? [...evaluationStructure.sections] : [];
  sections.sort((a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0));

  const sectionIds = [];
  const expectedBehaviorIdsBySection = new Map();
  const behaviorToSection = new Map();

  for (const sec of sections) {
    const sid = typeof sec?.id === 'string' ? sec.id.trim() : '';
    if (!sid) continue;
    const crits = Array.isArray(sec?.criteria) ? [...sec.criteria] : [];
    crits.sort((a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0));
    const bids = crits.map((c) => String(c?.behaviorItemId || '').trim()).filter(Boolean);
    sectionIds.push(sid);
    expectedBehaviorIdsBySection.set(sid, bids);
    for (const bid of bids) {
      behaviorToSection.set(bid, sid);
    }
  }

  return { sectionIds, expectedBehaviorIdsBySection, behaviorToSection };
}

/**
 * Strict validation for evaluations pinned to evaluationStructureVersionId.
 * Order: overrides → all N/A → N/A comments → SECTION_UNKNOWN_ITEM → SECTION_DUPLICATE_ITEM
 * → SECTION_NA_HAS_ITEM_RATINGS → SECTION_ITEM_COUNT_MISMATCH → SECTION_INCOMPLETE_RATINGS
 *
 * @param {object} body — req.body
 * @param {object} evaluationStructure — pinned structure JSON
 * @returns {{ ok: true, normalizedSectionOverrides: object } | { ok: false, response: object }}
 */
function validateEvaluationCreateWithPinnedStructure(body, evaluationStructure) {
  const { sectionIds, expectedBehaviorIdsBySection, behaviorToSection } = buildPinnedStructureIndex(evaluationStructure);

  if (sectionIds.length === 0) {
    return failResponse('Pinned evaluation structure has no sections.', 'INVALID_STRUCTURE');
  }

  const rawOverrides = body.sectionOverrides;
  const sectionOverrides =
    rawOverrides && typeof rawOverrides === 'object' && !Array.isArray(rawOverrides) ? rawOverrides : {};

  for (const key of Object.keys(sectionOverrides)) {
    if (!sectionIds.includes(key)) {
      return failResponse(`Unknown section id in sectionOverrides: ${key}`, 'UNKNOWN_SECTION_OVERRIDE', {
        sectionId: key,
      });
    }
    const entry = sectionOverrides[key];
    if (!entry || typeof entry !== 'object' || entry.notApplicable !== true) {
      return failResponse(
        `sectionOverrides.${key} must be { notApplicable: true, comment: string }`,
        'UNKNOWN_SECTION_OVERRIDE',
        { sectionId: key }
      );
    }
  }

  const naSectionIds = new Set();
  for (const sid of sectionIds) {
    const entry = sectionOverrides[sid];
    if (entry && entry.notApplicable === true) {
      const c = typeof entry.comment === 'string' ? entry.comment.trim() : '';
      if (!c) {
        return failResponse(`Section ${sid} is marked N/A but comment is required.`, 'SECTION_NA_COMMENT_REQUIRED', {
          sectionId: sid,
        });
      }
      naSectionIds.add(sid);
    }
  }

  if (naSectionIds.size === sectionIds.length) {
    return failResponse('All sections are marked N/A; at least one scored section is required.', 'ALL_REQUIRED_SECTIONS_NA');
  }

  const items = Array.isArray(body.items) ? body.items : [];

  const behaviorIdsInPayload = items.map((it) => (it && it.behaviorItemId != null ? String(it.behaviorItemId).trim() : ''));
  for (let i = 0; i < items.length; i++) {
    const bid = behaviorIdsInPayload[i];
    if (!bid || !behaviorToSection.has(bid)) {
      return failResponse(
        `behaviorItemId does not belong to pinned structure: ${bid || '(missing)'}`,
        'SECTION_UNKNOWN_ITEM',
        { behaviorItemId: bid || null }
      );
    }
  }

  const dupCheck = new Map();
  for (const bid of behaviorIdsInPayload) {
    dupCheck.set(bid, (dupCheck.get(bid) || 0) + 1);
  }
  for (const [bid, count] of dupCheck.entries()) {
    if (count > 1) {
      return failResponse(`Duplicate behaviorItemId in payload: ${bid}`, 'SECTION_DUPLICATE_ITEM', {
        behaviorItemId: bid,
      });
    }
  }

  const itemsByBehavior = new Map();
  for (const it of items) {
    const bid = String(it.behaviorItemId || '').trim();
    itemsByBehavior.set(bid, it);
  }

  for (const sid of sectionIds) {
    const expectedList = expectedBehaviorIdsBySection.get(sid) || [];
    const expectedSet = new Set(expectedList);

    if (naSectionIds.has(sid)) {
      for (const bid of expectedList) {
        if (itemsByBehavior.has(bid)) {
          return failResponse(
            `Section ${sid} is N/A but item ratings were submitted for behaviorItemId ${bid}`,
            'SECTION_NA_HAS_ITEM_RATINGS',
            { sectionId: sid, behaviorItemId: bid }
          );
        }
      }
      continue;
    }

    const actualSet = new Set();
    for (const it of items) {
      const bid = String(it.behaviorItemId || '').trim();
      if (behaviorToSection.get(bid) === sid) actualSet.add(bid);
    }
    if (actualSet.size !== expectedSet.size) {
      return failResponse(
        `Section ${sid}: submitted items must exactly match structure criteria (count mismatch).`,
        'SECTION_ITEM_COUNT_MISMATCH',
        { sectionId: sid, expectedCount: expectedSet.size, submittedCount: actualSet.size }
      );
    }
    for (const exp of expectedSet) {
      if (!actualSet.has(exp)) {
        return failResponse(
          `Section ${sid}: submitted items must exactly match structure criteria.`,
          'SECTION_ITEM_COUNT_MISMATCH',
          { sectionId: sid }
        );
      }
    }
  }

  for (const sid of sectionIds) {
    if (naSectionIds.has(sid)) continue;
    const expected = expectedBehaviorIdsBySection.get(sid) || [];
    for (const bid of expected) {
      const item = itemsByBehavior.get(bid);
      const score = item ? item.rating || item.score : undefined;
      if (score === undefined || score === null || Number(score) < 1 || Number(score) > 4 || !Number.isFinite(Number(score))) {
        return failResponse(
          `Section ${sid}: all criteria must have ratings 1–4. Invalid score for ${bid}: ${score}`,
          'SECTION_INCOMPLETE_RATINGS',
          { sectionId: sid, behaviorItemId: bid, score }
        );
      }
    }
  }

  const normalizedSectionOverrides = {};
  for (const sid of naSectionIds) {
    const entry = sectionOverrides[sid];
    normalizedSectionOverrides[sid] = {
      notApplicable: true,
      comment: String(entry.comment).trim(),
    };
  }

  return { ok: true, normalizedSectionOverrides };
}

module.exports = {
  validateEvaluationItemsForCreate,
  validateEvaluationCreateWithPinnedStructure,
  buildPinnedStructureIndex,
};
