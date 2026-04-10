/**
 * Phase 1B — evaluations handlers (orchestration).
 * Phase 2A — delegates validation, scoring, duplicate prevention, and read DTO mapping to src/evaluation/*.
 *
 * GET /evaluations/my parity: same role branches, SQL, scope via resolveCompanyContext.
 */
const {
  validateEvaluationItemsForCreate,
  validateEvaluationCreateWithPinnedStructure,
} = require('../evaluation/validation');
const {
  calculateOverallScore,
  calculateOverallScoreForPinnedStructure,
  getInvalidOverallScoreResponse,
} = require('../evaluation/scoring');
const { tryDuplicateEvaluationResponse } = require('../evaluation/duplicatePrevention');
const { mapMyEvaluationDto, buildResultView } = require('../evaluation/mappers');
const {
  getEvaluationStructureVersionForCompany,
} = require('./evaluationStructureConfig.service');

function createEvaluationsHandlers(deps) {
  const {
    pool,
    resolveCompanyContext,
    DEFAULT_COMPANY_ID,
    getUserTeamsColumns,
    getCompanyHierarchyTemplate,
    getCompanyFeatureFlags,
    getCompanyScoringProfile,
  } = deps;

  async function postEvaluation(req, res) {
      console.log('Evaluation creation request from user:', req.user.email);
      console.log('Evaluation data:', req.body);
      console.log('🔍 SalespersonId being submitted:', req.body.salespersonId);
      
      try {
        const { companyId: resolvedCompanyId } = resolveCompanyContext(req);
        const companyId = resolvedCompanyId || req.user?.companyId || DEFAULT_COMPANY_ID;

        // Verify the salespersonId exists in database
        const userCheck = await pool.query('SELECT id, "displayName", role, "companyId" FROM users WHERE id = $1', [req.body.salespersonId]);
        if (userCheck.rows.length === 0) {
          console.error('❌ Invalid salespersonId:', req.body.salespersonId);
          return res.status(400).json({ 
            message: 'Invalid salesperson ID', 
            error: `User with ID ${req.body.salespersonId} not found` 
          });
        }
        console.log('✅ Valid salesperson found:', userCheck.rows[0]);

        if (userCheck.rows[0].companyId !== companyId) {
          console.error('❌ Company mismatch between manager and salesperson', {
            managerCompany: companyId,
            salespersonCompany: userCheck.rows[0].companyId
          });
          return res.status(403).json({
            message: 'Salesperson belongs to a different company',
            error: 'COMPANY_MISMATCH'
          });
        }
      
        const duplicateEarly = await tryDuplicateEvaluationResponse(pool, {
          managerId: req.user.id,
          salespersonId: req.body.salespersonId,
          visitDate: req.body.visitDate,
          customerName: req.body.customerName || null,
          companyId
        });
        if (duplicateEarly) {
          return res.status(duplicateEarly.status).json(duplicateEarly.body);
        }
      
        const rawStructVer = req.body.evaluationStructureVersionId;
        let evaluationStructureVersionId = null;
        let pinnedStructureRow = null;
        let normalizedSectionOverrides = null;

        if (rawStructVer !== undefined && rawStructVer !== null && String(rawStructVer).trim()) {
          const trimmed = String(rawStructVer).trim();
          pinnedStructureRow = await getEvaluationStructureVersionForCompany(pool, trimmed, companyId);
          if (!pinnedStructureRow || !pinnedStructureRow.evaluationStructure) {
            return res.status(400).json({
              message: 'Evaluation structure version could not be loaded for this company.',
              error: 'STRUCTURE_VERSION_NOT_FOUND',
              evaluationStructureVersionId: trimmed,
            });
          }

          const pinnedValidation = validateEvaluationCreateWithPinnedStructure(
            req.body,
            pinnedStructureRow.evaluationStructure
          );
          if (!pinnedValidation.ok) {
            return res.status(400).json(pinnedValidation.response);
          }
          normalizedSectionOverrides = pinnedValidation.normalizedSectionOverrides;
          evaluationStructureVersionId = trimmed;
        } else {
          const itemValidation = validateEvaluationItemsForCreate(req.body);
          if (!itemValidation.ok) {
            if (itemValidation.response.error === 'INVALID_SCORE') {
              console.error(`❌ Invalid score for item ${itemValidation.response.itemId}: ${itemValidation.response.score}`);
            }
            return res.status(400).json(itemValidation.response);
          }
        }
      
      const evaluationId = `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const featureFlags = await getCompanyFeatureFlags(companyId);
        const scoringProfile = await getCompanyScoringProfile(companyId);

        let overallScore;
        if (pinnedStructureRow) {
          overallScore = calculateOverallScoreForPinnedStructure(
            req.body.items,
            pinnedStructureRow.evaluationStructure,
            normalizedSectionOverrides,
            scoringProfile,
            featureFlags
          );
        } else {
          overallScore = calculateOverallScore(req.body.items, scoringProfile, featureFlags);
        }
        
        const invalidOverall = getInvalidOverallScoreResponse(overallScore, {
          allowNullOverall: false,
        });
        if (invalidOverall) {
          console.error(`❌ Calculated overallScore is invalid: ${overallScore}`);
          return res.status(400).json(invalidOverall);
        }
        
        const itemsToInsert = Array.isArray(req.body.items) ? req.body.items : [];
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(`
          INSERT INTO evaluations (
            id, "salespersonId", "managerId", "visitDate", 
            "customerName", "customerType", location, "overallComment", "overallScore",
            version, "companyId", "evaluationStructureVersionId", "sectionOverrides", "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, NOW(), NOW())
        `, [
          evaluationId,
          req.body.salespersonId,
          req.user.id,
          req.body.visitDate,
          req.body.customerName || null,
          req.body.customerType || 'LOW_SHARE',
          req.body.location || null,
          req.body.overallComment || null,
          overallScore,
          1,
          companyId,
          evaluationStructureVersionId,
          normalizedSectionOverrides && Object.keys(normalizedSectionOverrides).length > 0
            ? JSON.stringify(normalizedSectionOverrides)
            : null,
        ]);
          for (let i = 0; i < itemsToInsert.length; i++) {
            const item = itemsToInsert[i];
            const score = item.rating || item.score;
            await client.query(`
            INSERT INTO evaluation_items (
              id, "evaluationId", "behaviorItemId", rating, comment,
              "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
          `, [
            `item_${evaluationId}_${i}`,
            evaluationId,
            item.behaviorItemId,
            score,
            item.comment || ''
          ]);
          }
          await client.query('COMMIT');
        } catch (txError) {
          try {
            await client.query('ROLLBACK');
          } catch (rollbackErr) {
            console.error('❌ ROLLBACK failed:', rollbackErr);
          }
          throw txError;
        } finally {
          client.release();
        }
        
        console.log(`✅ Saved evaluation ${evaluationId} to database for user ${req.user.email}`);
      
      res.status(201).json({ 
        message: 'Evaluation created successfully', 
        id: evaluationId,
        data: req.body
      });
      } catch (error) {
        console.error('❌ Error creating evaluation:', error);
        res.status(500).json({ 
          message: 'Failed to create evaluation', 
          error: error.message 
        });
      }
  }

  async function getMyEvaluations(req, res) {
      console.log('My evaluations request from user:', req.user.email);
      
      try {
        const { companyId, includeAllCompanies } = resolveCompanyContext(req);
        const { userCol, teamCol } = await getUserTeamsColumns(pool);

        const managerIds = new Set([req.user.id]);
        const salespersonIds = new Set([req.user.id]);

        if (req.user.role === 'REGIONAL_MANAGER' || req.user.role === 'REGIONAL_SALES_MANAGER') {
          const teamParams = [req.user.id];
          let teamQuery = `
            SELECT id FROM teams
            WHERE "managerId" = $1
          `;
          if (!includeAllCompanies) {
            teamParams.push(companyId);
            teamQuery += ` AND "companyId" = $${teamParams.length}`;
          }
          const teamResult = await pool.query(teamQuery, teamParams);
          const teamIds = teamResult.rows.map(row => row.id);

          if (teamIds.length > 0) {
            const memberParams = [teamIds];
            let membersQuery = `
              SELECT DISTINCT u.id
              FROM user_teams ut
              JOIN users u ON u.id = ut.${userCol}
              WHERE ut.${teamCol} = ANY($1::text[])
                AND u.role = 'SALES_LEAD'
            `;
            if (!includeAllCompanies) {
              memberParams.push(companyId);
              membersQuery += ` AND u."companyId" = $${memberParams.length}`;
            }
            const membersResult = await pool.query(membersQuery, memberParams);
            membersResult.rows.forEach(row => {
              if (row.id) {
                managerIds.add(row.id);
                salespersonIds.add(row.id);
              }
            });
          }
        }

        const isAdminViewRole = req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN';

        let evaluationsResult;
        if (isAdminViewRole) {
          // Admin views should see all evaluations in current company scope.
          const adminParams = [];
          let adminWhere = '';
          if (!includeAllCompanies) {
            adminParams.push(companyId);
            adminWhere = `WHERE e."companyId" = $${adminParams.length}`;
          }

          evaluationsResult = await pool.query(`
            SELECT
              e.id, e."salespersonId", e."managerId", e."visitDate",
              e."customerName", e.location, e."overallComment", e."overallScore",
              e.version, e."createdAt", e."updatedAt", e."companyId", e."evaluationStructureVersionId",
              e."sectionOverrides",
              sp."displayName" as salesperson_name, sp.email as salesperson_email,
              sp.role as salesperson_role, sp."companyId" as salesperson_company_id, sp."isActive" as salesperson_is_active,
              mg."displayName" as manager_name, mg.email as manager_email,
              mg.role as manager_role, mg."companyId" as manager_company_id, mg."isActive" as manager_is_active
            FROM evaluations e
            LEFT JOIN users sp ON sp.id = e."salespersonId"
            LEFT JOIN users mg ON mg.id = e."managerId"
            ${adminWhere}
            ORDER BY e."createdAt" DESC
          `, adminParams);
        } else {
          const managerIdArray = Array.from(managerIds);
          const salespersonIdArray = Array.from(salespersonIds);
          const evalParams = [managerIdArray, salespersonIdArray];

          let companyFilter = '';
          if (!includeAllCompanies) {
            evalParams.push(companyId);
            companyFilter = ` AND e."companyId" = $${evalParams.length}`;
          }

          // Get evaluations created by this user OR evaluations about this user
          evaluationsResult = await pool.query(`
            SELECT 
              e.id, e."salespersonId", e."managerId", e."visitDate",
              e."customerName", e.location, e."overallComment", e."overallScore",
              e.version, e."createdAt", e."updatedAt", e."companyId", e."evaluationStructureVersionId",
              e."sectionOverrides",
              sp."displayName" as salesperson_name, sp.email as salesperson_email,
              sp.role as salesperson_role, sp."companyId" as salesperson_company_id, sp."isActive" as salesperson_is_active,
              mg."displayName" as manager_name, mg.email as manager_email,
              mg.role as manager_role, mg."companyId" as manager_company_id, mg."isActive" as manager_is_active
            FROM evaluations e
            LEFT JOIN users sp ON sp.id = e."salespersonId"
            LEFT JOIN users mg ON mg.id = e."managerId"
            WHERE (
              e."managerId"::text = ANY($1::text[])
              OR e."salespersonId"::text = ANY($2::text[])
            )
            ${companyFilter}
            ORDER BY e."createdAt" DESC
          `, evalParams);
        }
        
        const evaluations = [];
        for (const evalRow of evaluationsResult.rows) {
          const itemsResult = await pool.query(`
            SELECT 
              ei.id, ei."behaviorItemId", ei.rating, ei.comment,
              bi.name as behavior_item_name,
              bc.name as category_name
            FROM evaluation_items ei
            LEFT JOIN behavior_items bi ON bi.id = ei."behaviorItemId"
            LEFT JOIN behavior_categories bc ON bc.id = bi."categoryId"
            WHERE ei."evaluationId" = $1
            ORDER BY ei."createdAt"
          `, [evalRow.id]);
          
          const pinnedVersionId = evalRow.evaluationStructureVersionId || null;
          let pinnedStructureRow = null;
          if (pinnedVersionId) {
            pinnedStructureRow = await getEvaluationStructureVersionForCompany(
              pool,
              pinnedVersionId,
              evalRow.companyId || companyId
            );
          }

          evaluations.push(
            mapMyEvaluationDto(evalRow, itemsResult.rows, req.user, {
              pinnedStructureRow,
              resultView: buildResultView({
                evalRow,
                itemRows: itemsResult.rows,
                pinnedStructureRow,
              }),
            })
          );
        }
        
        console.log(`✅ Found ${evaluations.length} evaluations for user ${req.user.email}`);
        res.json(evaluations);
      } catch (error) {
        console.error('❌ Error fetching evaluations:', error);
        res.status(500).json({ 
          message: 'Failed to fetch evaluations', 
          error: error.message 
        });
      }
  }

  return { postEvaluation, getMyEvaluations };
}

module.exports = { createEvaluationsHandlers, calculateOverallScore };
