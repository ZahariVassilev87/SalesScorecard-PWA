/**
 * Milestone 3 — published per-company evaluation structure (versioned sections + criteria).
 */
const crypto = require('crypto');
const { validateEvaluationStructureForPublish } = require('../evaluation/evaluationStructureValidation');

function buildStructureSummaryRow(row) {
  const structure =
    row.evaluationStructure && typeof row.evaluationStructure === 'object'
      ? row.evaluationStructure
      : { sections: [] };
  const sections = Array.isArray(structure.sections) ? structure.sections : [];
  let criterionCount = 0;
  sections.forEach((s) => {
    criterionCount += Array.isArray(s?.criteria) ? s.criteria.length : 0;
  });
  return {
    version: row.version,
    versionId: row.versionId,
    publishedAt: row.publishedAt,
    publishedBy: row.publishedBy,
    publishedByEmail: row.publishedByEmail || null,
    sectionCount: sections.length,
    criterionCount,
  };
}

/**
 * @returns {Promise<null | {
 *   versionId: string,
 *   version: number,
 *   evaluationStructure: object,
 *   publishedAt: Date,
 *   publishedBy: string | null,
 *   publishedByEmail: string | null
 * }>}
 */
async function getCurrentPublishedEvaluationStructure(pool, companyId) {
  const safeId = typeof companyId === 'string' ? companyId.trim() : '';
  if (!safeId) return null;

  const { rows } = await pool.query(
    `
    SELECT v.id AS "versionId", v.version, v."evaluationStructure", v."publishedAt", v."publishedBy",
           u.email AS "publishedByEmail"
    FROM company_evaluation_structure_current c
    JOIN company_evaluation_structure_versions v ON v.id = c."currentPublishedVersionId"
    LEFT JOIN users u ON u.id = v."publishedBy"
    WHERE c."companyId" = $1
    `,
    [safeId]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    versionId: r.versionId,
    version: r.version,
    evaluationStructure: r.evaluationStructure,
    publishedAt: r.publishedAt,
    publishedBy: r.publishedBy,
    publishedByEmail: r.publishedByEmail,
  };
}

/**
 * @param {string} versionId
 * @param {string} companyId
 * @returns {Promise<boolean>}
 */
async function getEvaluationStructureVersionForCompany(pool, versionId, companyId) {
  const vid = typeof versionId === 'string' ? versionId.trim() : '';
  const cid = typeof companyId === 'string' ? companyId.trim() : '';
  if (!vid || !cid) return null;
  const { rows } = await pool.query(
    `
    SELECT v.id AS "versionId", v.version, v."evaluationStructure", v."publishedAt", v."publishedBy",
           u.email AS "publishedByEmail"
    FROM company_evaluation_structure_versions v
    LEFT JOIN users u ON u.id = v."publishedBy"
    WHERE v.id = $1 AND v."companyId" = $2
    `,
    [vid, cid]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    versionId: r.versionId,
    version: r.version,
    evaluationStructure: r.evaluationStructure,
    publishedAt: r.publishedAt,
    publishedBy: r.publishedBy,
    publishedByEmail: r.publishedByEmail,
  };
}

async function evaluationStructureVersionExistsForCompany(pool, versionId, companyId) {
  const vid = typeof versionId === 'string' ? versionId.trim() : '';
  const cid = typeof companyId === 'string' ? companyId.trim() : '';
  if (!vid || !cid) return false;
  const { rows } = await pool.query(
    `SELECT 1 FROM company_evaluation_structure_versions WHERE id = $1 AND "companyId" = $2`,
    [vid, cid]
  );
  return rows.length > 0;
}

/**
 * Publish a new evaluation structure version and set as current.
 * @param {{ confirmReplace?: boolean }} [options]
 */
async function publishEvaluationStructure(pool, companyId, evaluationStructure, publishedBy, options = {}) {
  const v = await validateEvaluationStructureForPublish(pool, companyId, evaluationStructure);
  if (!v.ok) {
    const err = new Error(v.error || 'Invalid evaluation structure');
    err.statusCode = 400;
    err.code = v.code || 'INVALID_EVALUATION_STRUCTURE';
    if (v.validationErrors) err.validationErrors = v.validationErrors;
    throw err;
  }
  const normalized = v.normalized;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `
      SELECT v.id AS "versionId", v.version, v."publishedAt"
      FROM company_evaluation_structure_current c
      JOIN company_evaluation_structure_versions v ON v.id = c."currentPublishedVersionId"
      WHERE c."companyId" = $1
      `,
      [companyId]
    );
    if (existing.rows.length > 0 && !options.confirmReplace) {
      const block = new Error(
        'A published evaluation structure already exists for this company. Set confirmReplace: true in the request body to publish a new version.'
      );
      block.statusCode = 409;
      block.code = 'STRUCTURE_REPLACE_CONFIRMATION_REQUIRED';
      block.details = {
        currentVersion: existing.rows[0].version,
        currentPublishedVersionId: existing.rows[0].versionId,
        currentPublishedAt: existing.rows[0].publishedAt,
      };
      await client.query('ROLLBACK').catch(() => {});
      throw block;
    }

    const maxRow = await client.query(
      `SELECT COALESCE(MAX(version), 0) AS m FROM company_evaluation_structure_versions WHERE "companyId" = $1`,
      [companyId]
    );
    const nextVersion = Number(maxRow.rows[0].m) + 1;
    const id = crypto.randomUUID();

    const insertRow = await client.query(
      `
      INSERT INTO company_evaluation_structure_versions (
        id, "companyId", version, "evaluationStructure", "publishedAt", "publishedBy"
      ) VALUES ($1, $2, $3, $4::jsonb, NOW(), $5)
      RETURNING "publishedAt"
      `,
      [id, companyId, nextVersion, JSON.stringify(normalized), publishedBy || null]
    );

    await client.query(
      `
      INSERT INTO company_evaluation_structure_current ("companyId", "currentPublishedVersionId")
      VALUES ($1, $2)
      ON CONFLICT ("companyId") DO UPDATE SET
        "currentPublishedVersionId" = EXCLUDED."currentPublishedVersionId"
      `,
      [companyId, id]
    );

    await client.query('COMMIT');
    const publishedAt = insertRow.rows[0].publishedAt;
    const replaced =
      existing.rows.length > 0
        ? {
            replacedVersion: existing.rows[0].version,
            replacedVersionId: existing.rows[0].versionId,
          }
        : { replacedVersion: null, replacedVersionId: null };
    return {
      versionId: id,
      version: nextVersion,
      publishedAt,
      publishedBy: publishedBy || null,
      ...replaced,
    };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

function buildStructurePreviewPayload(evaluationStructure) {
  const structure =
    evaluationStructure && typeof evaluationStructure === 'object' ? evaluationStructure : { sections: [] };
  const sections = Array.isArray(structure.sections) ? structure.sections : [];
  return {
    sections: sections.map((s) => ({
      id: s.id,
      title: s.title,
      order: s.order,
      criteria: Array.isArray(s.criteria)
        ? s.criteria.map((c) => ({
            id: c.id,
            order: c.order,
            behaviorItemId: c.behaviorItemId,
          }))
        : [],
    })),
  };
}

module.exports = {
  getCurrentPublishedEvaluationStructure,
  publishEvaluationStructure,
  evaluationStructureVersionExistsForCompany,
  getEvaluationStructureVersionForCompany,
  buildStructureSummaryRow,
  buildStructurePreviewPayload,
};
