/**
 * Phase 2A — duplicate evaluation detection (same SQL and 5s window as before).
 */

const DOUBLE_SUBMIT_WINDOW_MS = 5000;

/**
 * If a recent duplicate exists within DOUBLE_SUBMIT_WINDOW_MS, returns { status, body } for the client.
 * Otherwise returns null (caller continues with create).
 */
async function tryDuplicateEvaluationResponse(pool, {
  managerId,
  salespersonId,
  visitDate,
  customerName,
  companyId,
}) {
  const duplicateCheck = await pool.query(`
      SELECT id, "createdAt"
      FROM evaluations
      WHERE "managerId" = $1
        AND "salespersonId" = $2
        AND DATE("visitDate") = DATE($3)
        AND COALESCE("customerName", '') = COALESCE($4, '')
        AND "companyId" = $5
      ORDER BY "createdAt" DESC
      LIMIT 1
    `, [
    managerId,
    salespersonId,
    visitDate,
    customerName,
    companyId
  ]);

  if (duplicateCheck.rows.length === 0) {
    return null;
  }

  const duplicate = duplicateCheck.rows[0];
  const timeDiff = Date.now() - new Date(duplicate.createdAt).getTime();
  if (timeDiff < DOUBLE_SUBMIT_WINDOW_MS) {
    console.log(`⚠️ Duplicate evaluation detected (created ${timeDiff}ms ago), returning existing evaluation`);
    return {
      status: 200,
      body: {
        message: 'Evaluation already exists',
        id: duplicate.id,
        duplicate: true
      }
    };
  }

  return null;
}

module.exports = {
  DOUBLE_SUBMIT_WINDOW_MS,
  tryDuplicateEvaluationResponse,
};
