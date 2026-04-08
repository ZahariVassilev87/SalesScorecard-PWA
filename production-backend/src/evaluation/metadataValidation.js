/**
 * Milestone 1 — validate and normalize evaluation.metadata against published company schema.
 */

const KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/;

/**
 * @param {unknown} rawInput — req.body.metadata
 * @param {unknown} metadataSchema — JSON from company_evaluation_config_versions.metadataSchema
 * @returns {{ ok: true, normalized: Record<string, string> } | { ok: false, response: object }}
 */
function validateEvaluationMetadata(rawInput, metadataSchema) {
  const raw =
    rawInput && typeof rawInput === 'object' && !Array.isArray(rawInput) ? rawInput : {};
  const schema = metadataSchema && typeof metadataSchema === 'object' ? metadataSchema : { fields: [] };
  const fields = Array.isArray(schema.fields) ? schema.fields : [];

  const normalized = {};
  const visibleFields = fields.filter((f) => f && f.visible !== false);
  const allowedKeys = new Set(
    visibleFields.map((f) => f.key).filter((k) => typeof k === 'string' && KEY_RE.test(k))
  );

  for (const key of Object.keys(raw)) {
    if (!allowedKeys.has(key)) continue;
    const val = raw[key];
    if (val === null || val === undefined) continue;
    normalized[key] = typeof val === 'string' ? val.trim() : String(val);
  }

  for (const field of visibleFields) {
    if (!field.key || typeof field.key !== 'string' || !KEY_RE.test(field.key)) continue;
    const type = field.type === 'select' ? 'select' : 'text';
    const required = field.required === true;
    const val = normalized[field.key];

    if (required && (val === undefined || val === '')) {
      return {
        ok: false,
        response: {
          message: `Metadata field "${field.key}" is required.`,
          error: 'INVALID_EVALUATION_METADATA',
          field: field.key,
        },
      };
    }
    if (val === undefined || val === '') continue;

    if (type === 'select') {
      const opts = Array.isArray(field.options) ? field.options : [];
      const allowed = opts.some((o) => o && String(o.value) === val);
      if (!allowed) {
        return {
          ok: false,
          response: {
            message: `Invalid value for metadata field "${field.key}".`,
            error: 'INVALID_EVALUATION_METADATA',
            field: field.key,
            score: val,
          },
        };
      }
    }
  }

  return { ok: true, normalized };
}

/**
 * Detailed validation for admin publish — lists every issue with field key/index where applicable.
 * @param {unknown} metadataSchema
 * @returns {{ ok: true } | { ok: false, errors: Array<{ code: string, message: string, fieldKey?: string, fieldIndex?: number }> }}
 */
function validateMetadataSchemaStructureDetailed(metadataSchema) {
  const errors = [];
  const push = (code, message, fieldKey, fieldIndex) => {
    const e = { code, message };
    if (fieldKey !== undefined) e.fieldKey = fieldKey;
    if (fieldIndex !== undefined) e.fieldIndex = fieldIndex;
    errors.push(e);
  };

  if (!metadataSchema || typeof metadataSchema !== 'object' || Array.isArray(metadataSchema)) {
    push('SCHEMA_NOT_OBJECT', 'metadataSchema must be an object.');
    return { ok: false, errors };
  }
  const fields = Array.isArray(metadataSchema.fields) ? metadataSchema.fields : null;
  if (!fields) {
    push('FIELDS_NOT_ARRAY', 'metadataSchema.fields must be an array.');
    return { ok: false, errors };
  }
  if (fields.length > 40) {
    push('TOO_MANY_FIELDS', 'At most 40 metadata fields allowed.');
    return { ok: false, errors };
  }
  const seen = new Set();
  fields.forEach((f, idx) => {
    if (!f || typeof f !== 'object') {
      push('FIELD_NOT_OBJECT', 'Each field must be an object.', undefined, idx);
      return;
    }
    if (typeof f.key !== 'string' || !KEY_RE.test(f.key)) {
      push(
        'INVALID_FIELD_KEY',
        `Invalid field key "${String(f.key)}": use letters, digits, underscore; must start with a letter.`,
        typeof f.key === 'string' ? f.key : undefined,
        idx
      );
      return;
    }
    if (seen.has(f.key)) {
      push('DUPLICATE_FIELD_KEY', `Duplicate field key: ${f.key}`, f.key, idx);
      return;
    }
    seen.add(f.key);
    const type = f.type === 'select' ? 'select' : f.type === 'text' ? 'text' : null;
    if (!type) {
      push('INVALID_FIELD_TYPE', `Field "${f.key}": type must be "text" or "select".`, f.key, idx);
      return;
    }
    if (type === 'select') {
      const opts = Array.isArray(f.options) ? f.options : [];
      if (opts.length === 0) {
        push('SELECT_OPTIONS_EMPTY', `Field "${f.key}": select fields require at least one option.`, f.key, idx);
        return;
      }
      opts.forEach((o, oi) => {
        if (!o || typeof o !== 'object') {
          push('INVALID_OPTION_ENTRY', `Field "${f.key}": invalid option entry at index ${oi}.`, f.key, idx);
        } else if (typeof o.value !== 'string' || typeof o.label !== 'string') {
          push(
            'INVALID_OPTION_VALUE_LABEL',
            `Field "${f.key}": each option needs string value and label (option index ${oi}).`,
            f.key,
            idx
          );
        }
      });
    }
  });
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/**
 * Validates shape before publish (admin). Returns { ok, error? }.
 * When invalid, also includes `errors` (same shape as validateMetadataSchemaStructureDetailed) for clients.
 * @param {unknown} metadataSchema
 */
function validateMetadataSchemaStructure(metadataSchema) {
  const detailed = validateMetadataSchemaStructureDetailed(metadataSchema);
  if (detailed.ok) {
    return { ok: true };
  }
  return {
    ok: false,
    error: detailed.errors[0].message,
    errors: detailed.errors,
  };
}

/**
 * Normalizes schema for storage (defaults visible/required).
 * @param {object} metadataSchema
 */
function normalizeMetadataSchemaForStorage(metadataSchema) {
  const fields = Array.isArray(metadataSchema.fields) ? metadataSchema.fields : [];
  return {
    fields: fields.map((f) => ({
      key: f.key,
      label: typeof f.label === 'string' ? f.label : f.key,
      type: f.type === 'select' ? 'select' : 'text',
      visible: f.visible !== false,
      required: f.required === true,
      ...(f.type === 'select' && Array.isArray(f.options)
        ? {
            options: f.options.map((o) => ({
              value: String(o.value),
              label: String(o.label),
            })),
          }
        : {}),
    })),
  };
}

module.exports = {
  validateEvaluationMetadata,
  validateMetadataSchemaStructure,
  validateMetadataSchemaStructureDetailed,
  normalizeMetadataSchemaForStorage,
};
