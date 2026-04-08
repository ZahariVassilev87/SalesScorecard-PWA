/**
 * Milestone 1 — published per-company evaluation metadata schema (versioned).
 */
const crypto = require('crypto');
const {
  validateMetadataSchemaStructure,
  normalizeMetadataSchemaForStorage,
} = require('../evaluation/metadataValidation');

/**
 * Ordered list of fields as end users see them (visible only; order preserved).
 * @param {object} metadataSchema — stored JSON schema
 */
function buildMetadataPreviewForUsers(metadataSchema) {
  const fields = Array.isArray(metadataSchema?.fields) ? metadataSchema.fields : [];
  return {
    fields: fields
      .filter((f) => f && f.visible !== false)
      .map((f) => {
        const row = {
          key: f.key,
          label: typeof f.label === 'string' ? f.label : f.key,
          type: f.type === 'select' ? 'select' : 'text',
          required: f.required === true,
        };
        if (f.type === 'select' && Array.isArray(f.options)) {
          row.options = f.options.map((o) => ({
            value: String(o.value),
            label: String(o.label),
          }));
        }
        return row;
      }),
  };
}

/**
 * Summary block for admin dashboards (current published schema).
 */
function buildCurrentVersionSummary(row) {
  const schema = row.metadataSchema && typeof row.metadataSchema === 'object' ? row.metadataSchema : { fields: [] };
  const allFields = Array.isArray(schema.fields) ? schema.fields : [];
  const visibleFields = allFields.filter((f) => f && f.visible !== false);
  const requiredVisible = visibleFields.filter((f) => f.required === true);
  return {
    version: row.version,
    versionId: row.versionId,
    publishedAt: row.publishedAt,
    publishedBy: row.publishedBy,
    publishedByEmail: row.publishedByEmail || null,
    fieldCount: allFields.length,
    visibleFieldCount: visibleFields.length,
    requiredFieldCount: requiredVisible.length,
    requiredFields: requiredVisible.map((f) => ({
      key: f.key,
      label: typeof f.label === 'string' ? f.label : f.key,
    })),
  };
}

/**
 * @returns {Promise<{
 *   versionId: string,
 *   version: number,
 *   metadataSchema: object,
 *   publishedAt: string,
 *   publishedBy: string | null,
 *   publishedByEmail: string | null
 * } | null>}
 * null = legacy (no published config for this company).
 */
async function getCurrentPublishedMetadataConfig(pool, companyId) {
  const safeId = typeof companyId === 'string' ? companyId.trim() : '';
  if (!safeId) return null;

  const { rows } = await pool.query(
    `
    SELECT v.id AS "versionId", v.version, v."metadataSchema", v."publishedAt", v."publishedBy",
           u.email AS "publishedByEmail"
    FROM company_evaluation_config_current c
    JOIN company_evaluation_config_versions v ON v.id = c."currentPublishedVersionId"
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
    metadataSchema: r.metadataSchema,
    publishedAt: r.publishedAt,
    publishedBy: r.publishedBy,
    publishedByEmail: r.publishedByEmail,
  };
}

/**
 * Publish a new metadata schema version and set as current.
 * @param {{ confirmReplace?: boolean }} [options] — if a published version already exists, confirmReplace must be true.
 * @returns {Promise<{
 *   versionId: string,
 *   version: number,
 *   publishedAt: Date,
 *   publishedBy: string | null,
 *   replacedVersion: number | null,
 *   replacedVersionId: string | null
 * }>}
 */
async function publishEvaluationMetadataSchema(pool, companyId, metadataSchema, publishedBy, options = {}) {
  const struct = validateMetadataSchemaStructure(metadataSchema);
  if (!struct.ok) {
    const err = new Error(struct.error);
    err.statusCode = 400;
    err.code = 'INVALID_METADATA_SCHEMA';
    if (struct.errors) err.validationErrors = struct.errors;
    throw err;
  }
  const normalized = normalizeMetadataSchemaForStorage(metadataSchema);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `
      SELECT v.id AS "versionId", v.version, v."publishedAt"
      FROM company_evaluation_config_current c
      JOIN company_evaluation_config_versions v ON v.id = c."currentPublishedVersionId"
      WHERE c."companyId" = $1
      `,
      [companyId]
    );
    if (existing.rows.length > 0 && !options.confirmReplace) {
      const block = new Error(
        'A published metadata schema already exists for this company. Set confirmReplace: true in the request body to publish a new version.'
      );
      block.statusCode = 409;
      block.code = 'METADATA_REPLACE_CONFIRMATION_REQUIRED';
      block.details = {
        currentVersion: existing.rows[0].version,
        currentPublishedVersionId: existing.rows[0].versionId,
        currentPublishedAt: existing.rows[0].publishedAt,
      };
      await client.query('ROLLBACK').catch(() => {});
      throw block;
    }

    const maxRow = await client.query(
      `SELECT COALESCE(MAX(version), 0) AS m FROM company_evaluation_config_versions WHERE "companyId" = $1`,
      [companyId]
    );
    const nextVersion = Number(maxRow.rows[0].m) + 1;
    const id = crypto.randomUUID();

    const insertRow = await client.query(
      `
      INSERT INTO company_evaluation_config_versions (
        id, "companyId", version, "metadataSchema", "publishedAt", "publishedBy"
      ) VALUES ($1, $2, $3, $4::jsonb, NOW(), $5)
      RETURNING "publishedAt"
      `,
      [id, companyId, nextVersion, JSON.stringify(normalized), publishedBy || null]
    );

    await client.query(
      `
      INSERT INTO company_evaluation_config_current ("companyId", "currentPublishedVersionId")
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

module.exports = {
  getCurrentPublishedMetadataConfig,
  publishEvaluationMetadataSchema,
  buildMetadataPreviewForUsers,
  buildCurrentVersionSummary,
};
