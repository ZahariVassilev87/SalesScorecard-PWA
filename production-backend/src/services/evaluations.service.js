/**
 * Phase 1B — evaluations handlers (moved from server.js; behavior unchanged).
 *
 * GET /evaluations/my parity (vs pre-Phase-1B server.js): same role branches
 * (REGIONAL_MANAGER | REGIONAL_SALES_MANAGER team/member expansion; SUPER_ADMIN | ADMIN
 * company-scoped admin query; else manager/salesperson visibility + optional company filter),
 * same SQL blocks, same response mapping and behavior-item fallbacks, same scope via
 * resolveCompanyContext (companyId / includeAllCompanies).
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
      
        // Check for duplicate evaluation (same manager, salesperson, visitDate, and customerName)
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
          req.user.id,
          req.body.salespersonId,
          req.body.visitDate,
          req.body.customerName || null,
          companyId
        ]);
        
        if (duplicateCheck.rows.length > 0) {
          const duplicate = duplicateCheck.rows[0];
          const timeDiff = Date.now() - new Date(duplicate.createdAt).getTime();
          // If duplicate was created within last 5 seconds, it's likely a double-submit
          if (timeDiff < 5000) {
            console.log(`⚠️ Duplicate evaluation detected (created ${timeDiff}ms ago), returning existing evaluation`);
            return res.status(200).json({
              message: 'Evaluation already exists',
              id: duplicate.id,
              duplicate: true
            });
          }
        }
      
      // Validate that all items have valid scores (1-4) BEFORE creating evaluation
        if (!req.body.items || req.body.items.length === 0) {
          return res.status(400).json({ 
            message: 'Evaluation must contain at least one item with a valid score (1-4)', 
            error: 'INVALID_EVALUATION_DATA' 
          });
        }
        
        // Validate all items have valid scores before proceeding
        for (let i = 0; i < req.body.items.length; i++) {
          const item = req.body.items[i];
          const score = item.rating || item.score;
          
          // Validate score is between 1 and 4
          if (!score || score < 1 || score > 4) {
            console.error(`❌ Invalid score for item ${item.behaviorItemId}: ${score}`);
            return res.status(400).json({ 
              message: `All evaluation items must have a valid score between 1 and 4. Item ${item.behaviorItemId} has invalid score: ${score}`, 
              error: 'INVALID_SCORE',
              itemId: item.behaviorItemId,
              score: score
            });
          }
        }
      
      const evaluationId = `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        // Calculate overallScore AFTER validation (so we know all items are valid)
        const featureFlags = await getCompanyFeatureFlags(companyId);
        const scoringProfile = await getCompanyScoringProfile(companyId);
        const overallScore = calculateOverallScore(req.body.items, scoringProfile, featureFlags);
        
        // Ensure overallScore is valid (between 1 and 4)
        if (!overallScore || overallScore < 1 || overallScore > 4) {
          console.error(`❌ Calculated overallScore is invalid: ${overallScore}`);
          return res.status(400).json({ 
            message: 'Failed to calculate overall score. Please ensure all items have valid scores between 1 and 4.', 
            error: 'INVALID_OVERALL_SCORE',
            calculatedScore: overallScore
          });
        }
        
        // Insert into evaluations table
        await pool.query(`
          INSERT INTO evaluations (
            id, "salespersonId", "managerId", "visitDate", 
            "customerName", "customerType", location, "overallComment", "overallScore",
            version, "companyId", "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
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
          companyId
        ]);
        
        // Insert evaluation items (already validated above)
        for (let i = 0; i < req.body.items.length; i++) {
          const item = req.body.items[i];
          const score = item.rating || item.score; // Already validated above
          
          await pool.query(`
            INSERT INTO evaluation_items (
              id, "evaluationId", "behaviorItemId", rating, comment,
              "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
          `, [
            `item_${evaluationId}_${i}`,
            evaluationId,
            item.behaviorItemId,
            score, // Use validated score (1-4)
            item.comment || '' // Store the actual user's comment text
          ]);
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
        const hierarchyTemplate = await getCompanyHierarchyTemplate(companyId);

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
              e.version, e."createdAt", e."updatedAt", e."companyId",
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
              e.version, e."createdAt", e."updatedAt", e."companyId",
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
        
        // Get evaluation items for each evaluation
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
          
          evaluations.push({
            id: evalRow.id,
            salespersonId: evalRow.salespersonId,
            salesperson: {
              id: evalRow.salespersonId,
              displayName: evalRow.salesperson_name,
              firstName: evalRow.salesperson_name?.split(' ')[0] || '',
              lastName: evalRow.salesperson_name?.split(' ').slice(1).join(' ') || '',
              email: evalRow.salesperson_email,
              role: evalRow.salesperson_role || 'SALESPERSON',
              isActive: typeof evalRow.salesperson_is_active === 'boolean' ? evalRow.salesperson_is_active : true,
              companyId: evalRow.salesperson_company_id || null
            },
            managerId: evalRow.managerId,
            manager: {
              id: evalRow.managerId,
              displayName: evalRow.manager_name,
              email: evalRow.manager_email,
              role: evalRow.manager_role || (evalRow.managerId === req.user.id ? req.user.role : 'SALES_LEAD'),
              isActive: typeof evalRow.manager_is_active === 'boolean' ? evalRow.manager_is_active : true,
              companyId: evalRow.manager_company_id || null
            },
            visitDate: evalRow.visitDate,
            customerName: evalRow.customerName,
            location: evalRow.location,
            overallComment: evalRow.overallComment,
            overallScore: evalRow.overallScore,
            version: evalRow.version,
            createdAt: evalRow.createdAt,
            updatedAt: evalRow.updatedAt,
            companyId: evalRow.companyId,
            items: itemsResult.rows.map(item => {
              // Handle both old format (custom IDs) and new format (database IDs)
              let behaviorItemName = item.behavior_item_name;
              let categoryName = item.category_name;
              
              // If no database match found, try to extract from comment metadata
              if (!behaviorItemName && item.comment) {
                try {
                  const metadata = JSON.parse(item.comment);
                  if (metadata.itemName) behaviorItemName = metadata.itemName;
                  if (metadata.categoryName) categoryName = metadata.categoryName;
                } catch (e) {
                  // Comment is not JSON, continue to check mappings
                }
              }
              
              // Fallback mapping for evaluation IDs (check if name is still null or is just the ID)
              if (!behaviorItemName || behaviorItemName === item.behaviorItemId || !categoryName) {
                const oldIdMappings = {
                  // New Regional Manager to Sales Lead Coaching Evaluation items
                  'coaching_communication': { name: 'Effective Communication', category: 'Coaching Skills' },
                  'coaching_development': { name: 'Team Development', category: 'Leadership' },
                  'coaching_performance': { name: 'Performance Management', category: 'Management' },
                  'coaching_strategy': { name: 'Strategic Planning', category: 'Strategy' },
                  
                  // New Sales Lead to Salesperson Evaluation items (Low Share)
                  'sales_prospecting': { name: 'Prospecting Skills', category: 'Sales Process' },
                  'sales_presentation': { name: 'Presentation Skills', category: 'Sales Process' },
                  'sales_negotiation': { name: 'Negotiation Skills', category: 'Sales Process' },
                  'sales_relationship': { name: 'Relationship Building', category: 'Customer Management' },
                  'sales_productivity': { name: 'Productivity & Organization', category: 'Performance' },
                  'sales_adaptability': { name: 'Adaptability & Learning', category: 'Growth' },
                  
                  // Coaching evaluation form mappings
                  'obs1': { name: 'Let salesperson lead the conversation', category: 'Observation & Intervention During Client Meeting' },
                  'obs2': { name: 'Provided support when needed', category: 'Observation & Intervention During Client Meeting' },
                  'obs3': { name: 'Stepped in with added value at right time', category: 'Observation & Intervention During Client Meeting' },
                  'obs4': { name: 'Actively listened to client and salesperson', category: 'Observation & Intervention During Client Meeting' },
                  'env1': { name: 'Ensured calm and safe atmosphere', category: 'Creating Coaching Environment' },
                  'env2': { name: 'Asked salesperson for self-assessment / feelings', category: 'Creating Coaching Environment' },
                  'env3': { name: 'Listened attentively without interrupting', category: 'Creating Coaching Environment' },
                  'fb1': { name: 'Started with positive practices', category: 'Quality of Analysis & Feedback' },
                  'fb2': { name: 'Gave concrete examples from client meeting', category: 'Quality of Analysis & Feedback' },
                  'fb3': { name: 'Identified areas for improvement with examples', category: 'Quality of Analysis & Feedback' },
                  'act1': { name: 'Set clear tasks for a specific period', category: 'Translating Into Action' },
                  'act2': { name: 'Reached agreement on evaluation and next steps', category: 'Translating Into Action' },
                  'act3': { name: 'Encouraged salesperson to set a personal goal/commitment', category: 'Translating Into Action' }
                };
                
                const mapping = oldIdMappings[item.behaviorItemId];
                if (mapping) {
                  if (!behaviorItemName) behaviorItemName = mapping.name;
                  if (!categoryName) categoryName = mapping.category;
                }
              }
              
              return {
                id: item.id,
                behaviorItemId: item.behaviorItemId,
                behaviorItem: {
                  id: item.behaviorItemId,
                  name: behaviorItemName || item.behaviorItemId,
                  category: { name: categoryName || 'Unknown Category' }
                },
                rating: item.rating,
                comment: item.comment
              };
            })
          });
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
