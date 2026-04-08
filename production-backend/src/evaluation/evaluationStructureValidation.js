/**
 * Milestone 3 — validate company evaluation structure (sections + criteria) for publish.
 */

const MAX_SECTIONS = 24;
const MAX_CRITERIA_TOTAL = 150;

async function getBehaviorJoinInfo(pool) {
  const [catRes, itemRes] = await Promise.all([
    pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'behavior_categories'
    `),
    pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'behavior_items'
    `),
  ]);
  const cat = new Set(catRes.rows.map((r) => r.column_name));
  const item = new Set(itemRes.rows.map((r) => r.column_name));
  const categoryCompanyColumn = cat.has('companyId')
    ? '"companyId"'
    : cat.has('company_id')
      ? 'company_id'
      : null;
  const categoryIdColumn = item.has('categoryId')
    ? '"categoryId"'
    : item.has('category_id')
      ? 'category_id'
      : '"categoryId"';
  const isActiveColumn = item.has('isActive')
    ? '"isActive"'
    : item.has('is_active')
      ? 'is_active'
      : null;
  return { categoryCompanyColumn, categoryIdColumn, isActiveColumn };
}

/**
 * @returns {Promise<Set<string>>}
 */
async function loadValidBehaviorItemIdsForCompany(pool, companyId) {
  const { categoryCompanyColumn, categoryIdColumn, isActiveColumn } = await getBehaviorJoinInfo(pool);
  const activeClause = isActiveColumn
    ? `AND COALESCE(bi.${isActiveColumn}, true) = true`
    : '';

  if (categoryCompanyColumn) {
    const { rows } = await pool.query(
      `
      SELECT bi.id::text AS id
      FROM behavior_items bi
      INNER JOIN behavior_categories bc ON bc.id = bi.${categoryIdColumn}
      WHERE bc.${categoryCompanyColumn} = $1
      ${activeClause}
      `,
      [companyId]
    );
    return new Set(rows.map((r) => r.id));
  }

  const { rows } = await pool.query(`
    SELECT bi.id::text AS id FROM behavior_items bi
    WHERE 1=1 ${activeClause}
  `);
  return new Set(rows.map((r) => r.id));
}

function collectCriterionBehaviorIds(evaluationStructure) {
  const sections = Array.isArray(evaluationStructure?.sections) ? evaluationStructure.sections : [];
  const ids = [];
  for (const sec of sections) {
    const criteria = Array.isArray(sec?.criteria) ? sec.criteria : [];
    for (const c of criteria) {
      if (c && typeof c.behaviorItemId === 'string' && c.behaviorItemId.trim()) {
        ids.push(c.behaviorItemId.trim());
      }
    }
  }
  return ids;
}

/**
 * @param {unknown} evaluationStructure
 * @returns {{ ok: boolean, error?: string, code?: string, validationErrors?: string[] }}
 */
function validateEvaluationStructureShapeDetailed(evaluationStructure) {
  const errors = [];
  if (!evaluationStructure || typeof evaluationStructure !== 'object' || Array.isArray(evaluationStructure)) {
    return { ok: false, error: 'evaluationStructure must be an object.', code: 'INVALID_STRUCTURE' };
  }
  const sections = Array.isArray(evaluationStructure.sections) ? evaluationStructure.sections : null;
  if (!sections) {
    return { ok: false, error: 'evaluationStructure.sections must be an array.', code: 'INVALID_STRUCTURE' };
  }
  if (sections.length === 0) {
    errors.push('At least one section is required.');
  }
  if (sections.length > MAX_SECTIONS) {
    errors.push(`At most ${MAX_SECTIONS} sections allowed.`);
  }

  const sectionIds = new Set();
  const criterionIds = new Set();
  const behaviorIds = new Set();
  let criterionCount = 0;

  sections.forEach((sec, si) => {
    if (!sec || typeof sec !== 'object') {
      errors.push(`sections[${si}] must be an object.`);
      return;
    }
    if (typeof sec.id !== 'string' || !sec.id.trim()) {
      errors.push(`sections[${si}].id must be a non-empty string.`);
    } else if (sectionIds.has(sec.id.trim())) {
      errors.push(`Duplicate section id: ${sec.id.trim()}`);
    } else {
      sectionIds.add(sec.id.trim());
    }
    if (typeof sec.title !== 'string' || !sec.title.trim()) {
      errors.push(`sections[${si}].title must be a non-empty string.`);
    }
    if (!Number.isFinite(Number(sec.order))) {
      errors.push(`sections[${si}].order must be a number.`);
    }
    const criteria = Array.isArray(sec.criteria) ? sec.criteria : [];
    if (criteria.length === 0) {
      errors.push(`sections[${si}].criteria must contain at least one criterion.`);
    }
    criteria.forEach((c, ci) => {
      criterionCount += 1;
      if (!c || typeof c !== 'object') {
        errors.push(`sections[${si}].criteria[${ci}] must be an object.`);
        return;
      }
      if (typeof c.id !== 'string' || !c.id.trim()) {
        errors.push(`sections[${si}].criteria[${ci}].id must be a non-empty string.`);
      } else if (criterionIds.has(c.id.trim())) {
        errors.push(`Duplicate criterion id: ${c.id.trim()}`);
      } else {
        criterionIds.add(c.id.trim());
      }
      if (!Number.isFinite(Number(c.order))) {
        errors.push(`sections[${si}].criteria[${ci}].order must be a number.`);
      }
      if (typeof c.behaviorItemId !== 'string' || !c.behaviorItemId.trim()) {
        errors.push(`sections[${si}].criteria[${ci}].behaviorItemId must be a non-empty string.`);
      } else {
        const bid = c.behaviorItemId.trim();
        if (behaviorIds.has(bid)) {
          errors.push(`Duplicate behaviorItemId across structure: ${bid}`);
        } else {
          behaviorIds.add(bid);
        }
      }
    });
  });

  if (criterionCount > MAX_CRITERIA_TOTAL) {
    errors.push(`At most ${MAX_CRITERIA_TOTAL} criteria allowed.`);
  }

  if (errors.length > 0) {
    return { ok: false, error: errors[0], code: 'INVALID_STRUCTURE', validationErrors: errors };
  }
  return { ok: true };
}

/**
 * @param {object} evaluationStructure — validated object
 */
function normalizeEvaluationStructureForStorage(evaluationStructure) {
  const sections = Array.isArray(evaluationStructure.sections) ? [...evaluationStructure.sections] : [];
  sections.sort((a, b) => Number(a.order) - Number(b.order));
  const normalizedSections = sections.map((sec) => {
    const criteria = Array.isArray(sec.criteria) ? [...sec.criteria] : [];
    criteria.sort((a, b) => Number(a.order) - Number(b.order));
    return {
      id: String(sec.id).trim(),
      order: Number(sec.order),
      title: String(sec.title).trim(),
      criteria: criteria.map((c) => ({
        id: String(c.id).trim(),
        order: Number(c.order),
        behaviorItemId: String(c.behaviorItemId).trim(),
      })),
    };
  });
  return { sections: normalizedSections };
}

/**
 * @returns {Promise<{ ok: boolean, error?: string, code?: string, validationErrors?: string[], normalized?: object }>}
 */
async function validateEvaluationStructureForPublish(pool, companyId, evaluationStructure) {
  const struct = validateEvaluationStructureShapeDetailed(evaluationStructure);
  if (!struct.ok) return struct;

  const normalized = normalizeEvaluationStructureForStorage(evaluationStructure);
  const behaviorIds = collectCriterionBehaviorIds(normalized);
  const validSet = await loadValidBehaviorItemIdsForCompany(pool, companyId);
  const missing = behaviorIds.filter((id) => !validSet.has(id));
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Unknown or inactive behaviorItemId for this company: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`,
      code: 'INVALID_BEHAVIOR_ITEM_IDS',
      validationErrors: missing.map((id) => `Invalid behaviorItemId: ${id}`),
    };
  }
  return { ok: true, normalized };
}

module.exports = {
  MAX_SECTIONS,
  MAX_CRITERIA_TOTAL,
  validateEvaluationStructureShapeDetailed,
  normalizeEvaluationStructureForStorage,
  validateEvaluationStructureForPublish,
  loadValidBehaviorItemIdsForCompany,
  collectCriterionBehaviorIds,
};
