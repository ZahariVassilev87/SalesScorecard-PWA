/**
 * Phase 1B — analytics handlers (moved from server.js; behavior unchanged).
 */

function createAnalyticsHandlers(deps) {
  const {
    pool,
    resolveCompanyContext,
    getUserTeamsColumns,
    getStoredEvaluations,
  } = deps;

  async function getDashboard(req, res) {
      try {
      console.log('Dashboard analytics request from user:', req.user.email);
        
        // Get comprehensive dashboard data for Sales Directors
        if (req.user.role === 'SALES_DIRECTOR') {
          const { companyId, includeAllCompanies } = resolveCompanyContext(req);
          const companyParams = includeAllCompanies ? [] : [companyId];
          const companyFilter = includeAllCompanies ? '' : ' AND r."companyId" = $1';
          const userCompanyFilter = includeAllCompanies ? '' : ' AND u."companyId" = $1';
          const evaluationCompanyFilter = includeAllCompanies ? '' : ' AND e."companyId" = $1';
          const evaluationParams = companyParams.slice();
          
          // Get total regions
          const regionsResult = await pool.query(
            `SELECT COUNT(*) as count FROM regions r WHERE r."isActive" = true${companyFilter}`,
            companyParams
          );
          const totalRegions = parseInt(regionsResult.rows[0].count) || 0;

          // Get total team members (all active users)
          const usersResult = await pool.query(
            `SELECT COUNT(*) as count FROM users u WHERE u."isActive" = true${userCompanyFilter}`,
            companyParams
          );
          const totalTeamMembers = parseInt(usersResult.rows[0].count) || 0;

          // Base evaluation query parts
          const evaluationJoins = `
            FROM evaluations e
            LEFT JOIN users sp ON sp.id = e."salespersonId"
            LEFT JOIN users mg ON mg.id = e."managerId"
            WHERE sp."isActive" = true
              AND mg."isActive" = true
              AND sp."companyId" = e."companyId"
              AND mg."companyId" = e."companyId"
              ${evaluationCompanyFilter}
          `;
          
          // Get total evaluations
          const evaluationsResult = await pool.query(
            `SELECT COUNT(DISTINCT e.id) as count ${evaluationJoins}`,
            evaluationParams
          );
          const totalEvaluations = parseInt(evaluationsResult.rows[0].count) || 0;
          
          // Get average performance (average of all evaluation scores)
          const avgScoreResult = await pool.query(
            `SELECT AVG(e."overallScore") as avg_score ${evaluationJoins} AND e."overallScore" IS NOT NULL`,
            evaluationParams
          );
          const averagePerformance = avgScoreResult.rows[0].avg_score ? 
            Math.round((parseFloat(avgScoreResult.rows[0].avg_score) / 4) * 100) : 0;
          
          // Get evaluations completed this month
          const thisMonthResult = await pool.query(`
            SELECT COUNT(DISTINCT e.id) as count
            ${evaluationJoins}
            AND DATE_TRUNC('month', e."createdAt") = DATE_TRUNC('month', CURRENT_DATE)
          `, evaluationParams);
          const evaluationsCompleted = parseInt(thisMonthResult.rows[0].count) || 0;
          
          // Get average score (1-4 scale)
          const averageScore = avgScoreResult.rows[0].avg_score ? 
            parseFloat(avgScoreResult.rows[0].avg_score).toFixed(1) : 0;
          
      res.json({
            totalRegions,
            totalTeamMembers,
            averagePerformance,
            totalEvaluations,
            evaluationsCompleted,
            averageScore
          });
        } else {
          // For other roles, return basic evaluation data
          const userEvaluationsResult = await pool.query(`
            SELECT COUNT(*) as count FROM evaluations 
            WHERE "managerId" = $1 OR "salespersonId" = $1
          `, [req.user.id]);
          const totalEvaluations = parseInt(userEvaluationsResult.rows[0].count) || 0;
          
          const avgScoreResult = await pool.query(`
            SELECT AVG("overallScore") as avg_score FROM evaluations 
            WHERE ("managerId" = $1 OR "salespersonId" = $1) AND "overallScore" IS NOT NULL
          `, [req.user.id]);
          const averageScore = avgScoreResult.rows[0].avg_score ? 
            parseFloat(avgScoreResult.rows[0].avg_score).toFixed(1) : 0;
          
          const thisMonthResult = await pool.query(`
            SELECT COUNT(*) as count FROM evaluations 
            WHERE ("managerId" = $1 OR "salespersonId" = $1) 
            AND DATE_TRUNC('month', "createdAt") = DATE_TRUNC('month', CURRENT_DATE)
          `, [req.user.id]);
          const evaluationsCompleted = parseInt(thisMonthResult.rows[0].count) || 0;
          
          res.json({
            totalRegions: 0,
            totalTeamMembers: 0,
            averagePerformance: avgScoreResult.rows[0].avg_score ? 
              Math.round((parseFloat(avgScoreResult.rows[0].avg_score) / 4) * 100) : 0,
            totalEvaluations,
            evaluationsCompleted,
            averageScore
          });
        }
      } catch (error) {
        console.error('Error in /analytics/dashboard:', error);
        res.status(500).json({ 
          message: 'Failed to fetch dashboard data', 
          error: error.message 
        });
      }
  }

  function getTeam(req, res) {
      console.log('Team analytics request from user:', req.user.email);
      res.json({
        teamEvaluations: getStoredEvaluations().filter(eval => eval.managerId === req.user.id),
        teamAverageScore: 0 // Calculate based on team evaluations
      });
  }

  async function getDirectorDashboard(req, res) {
      try {
        // Only allow Sales Directors to access this endpoint
        if (req.user.role !== 'SALES_DIRECTOR' && req.user.role !== 'ADMIN') {
          return res.status(403).json({ error: 'Only Sales Directors can access this dashboard' });
        }

        console.log('📊 Sales Director dashboard request from:', req.user.email);

        const { userCol, teamCol } = await getUserTeamsColumns(pool);
        const { companyId, includeAllCompanies } = resolveCompanyContext(req);
        const queryParams = includeAllCompanies ? [] : [companyId];
        const companyFilter = includeAllCompanies ? '' : ' AND e."companyId" = $1';
        const regionalManagerFilter = includeAllCompanies ? '' : ' AND rm."companyId" = $1';
        const managerCompanyFilter = includeAllCompanies ? '' : ' AND mg."companyId" = $1';

        // Get regional execution performance (salespeople evaluations by sales leads)
        const regionalExecutionQuery = `
          SELECT 
            t."regionId",
            r.name as region_name,
            COUNT(DISTINCT e.id) as execution_evaluations,
            AVG(e."overallScore") as avg_execution_score,
            COUNT(DISTINCT e."salespersonId") as unique_salespeople_evaluated,
            COUNT(DISTINCT e."managerId") as unique_sales_leads_evaluating
          FROM evaluations e
          LEFT JOIN users sp ON sp.id = e."salespersonId"
          LEFT JOIN users mg ON mg.id = e."managerId"
          LEFT JOIN user_teams ut ON ut.${userCol} = sp.id
          LEFT JOIN teams t ON ut.${teamCol} = t.id
          LEFT JOIN regions r ON r.id = t."regionId"
          WHERE e."overallScore" IS NOT NULL
            AND sp.role = 'SALESPERSON'
            AND mg.role = 'SALES_LEAD'
            ${companyFilter}
            AND sp."companyId" = e."companyId"
            AND mg."companyId" = e."companyId"
            AND sp."isActive" = true
            AND mg."isActive" = true
          GROUP BY t."regionId", r.name
          ORDER BY avg_execution_score DESC
        `;

        // Get regional coaching performance (sales leads evaluations by regional managers)
        const regionalCoachingQuery = `
          SELECT 
            t."regionId",
            r.name as region_name,
            COUNT(DISTINCT e.id) as coaching_evaluations,
            AVG(e."overallScore") as avg_coaching_score,
            COUNT(DISTINCT e."salespersonId") as unique_sales_leads_evaluated,
            COUNT(DISTINCT e."managerId") as unique_regional_managers_evaluating
          FROM evaluations e
          LEFT JOIN users sp ON sp.id = e."salespersonId"
          LEFT JOIN users mg ON mg.id = e."managerId"
          LEFT JOIN user_teams ut ON ut.${userCol} = sp.id
          LEFT JOIN teams t ON ut.${teamCol} = t.id
          LEFT JOIN regions r ON r.id = t."regionId"
          WHERE e."overallScore" IS NOT NULL
            AND sp.role = 'SALES_LEAD'
            AND mg.role IN ('REGIONAL_MANAGER', 'REGIONAL_SALES_MANAGER')
            ${companyFilter}
            AND sp."companyId" = e."companyId"
            AND mg."companyId" = e."companyId"
            AND sp."isActive" = true
            AND mg."isActive" = true
          GROUP BY t."regionId", r.name
          ORDER BY avg_coaching_score DESC
        `;

        const regionalExecutionResult = await pool.query(regionalExecutionQuery, queryParams);
        const regionalCoachingResult = await pool.query(regionalCoachingQuery, queryParams);
        
        // Get salespeople execution performance (evaluations OF salespeople BY sales leads)
        const salespeopleExecutionQuery = `
          SELECT 
            mg.id as sales_lead_id,
            mg."displayName" as sales_lead_name,
            mg.email as sales_lead_email,
            COUNT(DISTINCT e.id) as evaluations_created,
            AVG(e."overallScore") as avg_execution_score,
            t."regionId",
            r.name as region_name
          FROM evaluations e
          LEFT JOIN users mg ON mg.id = e."managerId"
          LEFT JOIN users sp ON sp.id = e."salespersonId"
          LEFT JOIN user_teams ut ON ut.${userCol} = mg.id
          LEFT JOIN teams t ON ut.${teamCol} = t.id
          LEFT JOIN regions r ON r.id = t."regionId"
          WHERE mg.role = 'SALES_LEAD' 
            AND sp.role = 'SALESPERSON'
            AND e."overallScore" IS NOT NULL
            ${companyFilter}
            AND sp."companyId" = e."companyId"
            AND mg."companyId" = e."companyId"
            AND sp."isActive" = true
            AND mg."isActive" = true
          GROUP BY mg.id, mg."displayName", mg.email, t."regionId", r.name
          ORDER BY avg_execution_score DESC
        `;

        const salespeopleExecutionResult = await pool.query(salespeopleExecutionQuery, queryParams);

        // Get sales lead coaching performance (evaluations OF sales leads by regional managers)
        const salesLeadCoachingQuery = `
          SELECT 
            sp.id as sales_lead_id,
            sp."displayName" as sales_lead_name,
            sp.email as sales_lead_email,
            mg.id as regional_manager_id,
            mg."displayName" as regional_manager_name,
            COUNT(DISTINCT e.id) as coaching_evaluations_received,
            AVG(e."overallScore") as avg_coaching_score,
            t."regionId",
            r.name as region_name
          FROM evaluations e
          LEFT JOIN users sp ON sp.id = e."salespersonId"
          LEFT JOIN users mg ON mg.id = e."managerId"
          LEFT JOIN user_teams ut ON ut.${userCol} = sp.id
          LEFT JOIN teams t ON ut.${teamCol} = t.id
          LEFT JOIN regions r ON r.id = t."regionId"
          WHERE sp.role = 'SALES_LEAD' 
            AND mg.role IN ('REGIONAL_MANAGER', 'REGIONAL_SALES_MANAGER')
            AND e."overallScore" IS NOT NULL
            ${companyFilter}
            AND sp."companyId" = e."companyId"
            AND mg."companyId" = e."companyId"
            AND sp."isActive" = true
            AND mg."isActive" = true
          GROUP BY sp.id, sp."displayName", sp.email, mg.id, mg."displayName", t."regionId", r.name
          ORDER BY avg_coaching_score DESC
        `;

        const salesLeadCoachingResult = await pool.query(salesLeadCoachingQuery, queryParams);

        // Get overall company execution metrics (salespeople evaluations)
        const companyExecutionMetricsQuery = `
          SELECT 
            COUNT(DISTINCT e.id) as total_execution_evaluations,
            AVG(e."overallScore") as avg_execution_score,
            COUNT(DISTINCT e."salespersonId") as total_salespeople_evaluated,
            COUNT(DISTINCT e."managerId") as total_sales_leads_evaluating
          FROM evaluations e
          LEFT JOIN users sp ON sp.id = e."salespersonId"
          LEFT JOIN users mg ON mg.id = e."managerId"
          WHERE e."overallScore" IS NOT NULL
            AND sp.role = 'SALESPERSON'
            AND mg.role = 'SALES_LEAD'
            ${companyFilter}
            AND sp."companyId" = e."companyId"
            AND mg."companyId" = e."companyId"
            AND sp."isActive" = true
            AND mg."isActive" = true
        `;

        // Get overall company coaching metrics (sales leads evaluations)
        const companyCoachingMetricsQuery = `
          SELECT 
            COUNT(DISTINCT e.id) as total_coaching_evaluations,
            AVG(e."overallScore") as avg_coaching_score,
            COUNT(DISTINCT e."salespersonId") as total_sales_leads_evaluated,
            COUNT(DISTINCT e."managerId") as total_regional_managers_evaluating
          FROM evaluations e
          LEFT JOIN users sp ON sp.id = e."salespersonId"
          LEFT JOIN users mg ON mg.id = e."managerId"
          WHERE e."overallScore" IS NOT NULL
            AND sp.role = 'SALES_LEAD'
            AND mg.role IN ('REGIONAL_MANAGER', 'REGIONAL_SALES_MANAGER')
            ${companyFilter}
            AND sp."companyId" = e."companyId"
            AND mg."companyId" = e."companyId"
            AND sp."isActive" = true
            AND mg."isActive" = true
        `;

        // Get Share of Wallet distribution for sales behaviours evaluations (exclude COACHING type)
        const shareOfWalletQuery = `
          SELECT 
            COALESCE("customerType", 'LOW_SHARE') as customer_type,
            COUNT(DISTINCT e.id) as evaluation_count,
            AVG(e."overallScore") as avg_score,
            ROUND(COUNT(DISTINCT e.id) * 100.0 / SUM(COUNT(DISTINCT e.id)) OVER (), 1) as percentage
          FROM evaluations e
          LEFT JOIN users sp ON sp.id = e."salespersonId"
          LEFT JOIN users mg ON mg.id = e."managerId"
          WHERE e."overallScore" IS NOT NULL
            AND sp.role = 'SALESPERSON'
            AND mg.role = 'SALES_LEAD'
            AND COALESCE("customerType", 'LOW_SHARE') != 'COACHING'
            ${companyFilter}
            AND sp."companyId" = e."companyId"
            AND mg."companyId" = e."companyId"
            AND sp."isActive" = true
            AND mg."isActive" = true
          GROUP BY COALESCE("customerType", 'LOW_SHARE')
          ORDER BY 
            CASE COALESCE("customerType", 'LOW_SHARE')
              WHEN 'HIGH_SHARE' THEN 1
              WHEN 'MID_SHARE' THEN 2
              WHEN 'LOW_SHARE' THEN 3
              ELSE 4
            END
        `;

        // Get overall user counts
        const userCountsQuery = `
          SELECT 
            COUNT(DISTINCT CASE WHEN role = 'SALES_LEAD' THEN id END) as total_sales_leads,
            COUNT(DISTINCT CASE WHEN role IN ('REGIONAL_MANAGER', 'REGIONAL_SALES_MANAGER') THEN id END) as total_regional_managers,
            COUNT(DISTINCT CASE WHEN role = 'SALESPERSON' THEN id END) as total_salespeople
          FROM users
          WHERE "isActive" = true
            ${includeAllCompanies ? '' : 'AND "companyId" = $1'}
        `;

        const companyExecutionResult = await pool.query(companyExecutionMetricsQuery, queryParams);
        const companyCoachingResult = await pool.query(companyCoachingMetricsQuery, queryParams);
        const shareOfWalletResult = await pool.query(shareOfWalletQuery, queryParams);
        const userCountsResult = await pool.query(userCountsQuery, queryParams);

        // Get recent execution trends (last 30 days)
        const executionTrendsQuery = `
          SELECT 
            DATE(e."createdAt") as evaluation_date,
            COUNT(e.id) as evaluations_count,
            AVG(e."overallScore") as avg_score
          FROM evaluations e
          LEFT JOIN users sp ON sp.id = e."salespersonId"
          LEFT JOIN users mg ON mg.id = e."managerId"
          WHERE e."createdAt" >= NOW() - INTERVAL '30 days'
            AND e."overallScore" IS NOT NULL
            AND sp.role = 'SALESPERSON'
            AND mg.role = 'SALES_LEAD'
            ${companyFilter}
            AND sp."companyId" = e."companyId"
            AND mg."companyId" = e."companyId"
          GROUP BY DATE(e."createdAt")
          ORDER BY evaluation_date DESC
          LIMIT 30
        `;

        // Get recent coaching trends (last 30 days)
        const coachingTrendsQuery = `
          SELECT 
            DATE(e."createdAt") as evaluation_date,
            COUNT(e.id) as evaluations_count,
            AVG(e."overallScore") as avg_score
          FROM evaluations e
          LEFT JOIN users sp ON sp.id = e."salespersonId"
          LEFT JOIN users mg ON mg.id = e."managerId"
          WHERE e."createdAt" >= NOW() - INTERVAL '30 days'
            AND e."overallScore" IS NOT NULL
            AND sp.role = 'SALES_LEAD'
            AND mg.role IN ('REGIONAL_MANAGER', 'REGIONAL_SALES_MANAGER')
            ${companyFilter}
            AND sp."companyId" = e."companyId"
            AND mg."companyId" = e."companyId"
          GROUP BY DATE(e."createdAt")
          ORDER BY evaluation_date DESC
          LIMIT 30
        `;

        const executionTrendsResult = await pool.query(executionTrendsQuery, queryParams);
        const coachingTrendsResult = await pool.query(coachingTrendsQuery, queryParams);

        // Get regional managers execution metrics (sales behaviours performance by regional manager)
        // This aggregates all sales behaviours evaluations done by sales leads under each regional manager
        const regionalExecutionMetricsQuery = `
          SELECT 
            rm.id as regional_manager_id,
            rm."displayName" as regional_manager_name,
            rm.email as regional_manager_email,
            t."regionId",
            r.name as region_name,
            COUNT(DISTINCT e.id) as execution_evaluations,
            AVG(e."overallScore") as avg_execution_score,
            COUNT(DISTINCT e."salespersonId") as unique_salespeople_evaluated,
            COUNT(DISTINCT e."managerId") as unique_sales_leads_evaluating
          FROM users rm
          LEFT JOIN user_teams ut ON ut.${userCol} = rm.id
          LEFT JOIN teams t ON ut.${teamCol} = t.id
          LEFT JOIN regions r ON r.id = t."regionId"
          LEFT JOIN teams sl_team ON sl_team."managerId" = rm.id
          LEFT JOIN user_teams sl_ut ON sl_ut.${teamCol} = sl_team.id
          LEFT JOIN users sl ON sl.id = sl_ut.${userCol} AND sl.role = 'SALES_LEAD'
          LEFT JOIN evaluations e ON e."managerId" = sl.id
          LEFT JOIN users sp ON sp.id = e."salespersonId" AND sp.role = 'SALESPERSON'
          WHERE rm.role IN ('REGIONAL_MANAGER', 'REGIONAL_SALES_MANAGER')
            AND rm."isActive" = true
            AND e."overallScore" IS NOT NULL
            ${companyFilter}
            ${regionalManagerFilter}
            AND sl."companyId" = e."companyId"
            AND COALESCE(sp."companyId", e."companyId") = e."companyId"
          GROUP BY rm.id, rm."displayName", rm.email, t."regionId", r.name
          ORDER BY avg_execution_score DESC
        `;

        // Get regional managers coaching metrics (coaching performance by regional manager)
        const regionalCoachingMetricsQuery = `
          SELECT 
            mg.id as regional_manager_id,
            mg."displayName" as regional_manager_name,
            mg.email as regional_manager_email,
            t."regionId",
            r.name as region_name,
            COUNT(DISTINCT e.id) as coaching_evaluations,
            AVG(e."overallScore") as avg_coaching_score,
            COUNT(DISTINCT e."salespersonId") as unique_sales_leads_evaluated
          FROM evaluations e
          LEFT JOIN users sp ON sp.id = e."salespersonId"
          LEFT JOIN users mg ON mg.id = e."managerId"
          LEFT JOIN user_teams ut ON ut.${userCol} = mg.id
          LEFT JOIN teams t ON ut.${teamCol} = t.id
          LEFT JOIN regions r ON r.id = t."regionId"
          WHERE e."overallScore" IS NOT NULL
            AND sp.role = 'SALES_LEAD'
            AND mg.role IN ('REGIONAL_MANAGER', 'REGIONAL_SALES_MANAGER')
            ${companyFilter}
            ${managerCompanyFilter}
            AND sp."companyId" = e."companyId"
            AND sp."isActive" = true
            AND mg."isActive" = true
          GROUP BY mg.id, mg."displayName", mg.email, t."regionId", r.name
          ORDER BY avg_coaching_score DESC
        `;

        const regionalExecutionMetricsResult = await pool.query(regionalExecutionMetricsQuery, queryParams);
        const regionalCoachingMetricsResult = await pool.query(regionalCoachingMetricsQuery, queryParams);

        const dashboardData = {
          // Regional execution performance (salespeople evaluations by sales leads)
          regionalExecutionPerformance: regionalExecutionResult.rows.map(row => ({
            regionId: row.regionId,
            regionName: row.region_name,
            executionEvaluations: parseInt(row.execution_evaluations),
            avgExecutionScore: parseFloat(row.avg_execution_score) || 0,
            uniqueSalespeopleEvaluated: parseInt(row.unique_salespeople_evaluated),
            uniqueSalesLeadsEvaluating: parseInt(row.unique_sales_leads_evaluating)
          })),
          
          // Regional coaching performance (sales leads evaluations by regional managers)
          regionalCoachingPerformance: regionalCoachingResult.rows.map(row => ({
            regionId: row.regionId,
            regionName: row.region_name,
            coachingEvaluations: parseInt(row.coaching_evaluations),
            avgCoachingScore: parseFloat(row.avg_coaching_score) || 0,
            uniqueSalesLeadsEvaluated: parseInt(row.unique_sales_leads_evaluated),
            uniqueRegionalManagersEvaluating: parseInt(row.unique_regional_managers_evaluating)
          })),
          
          // Salespeople execution performance (by sales lead)
          salespeopleExecutionPerformance: salespeopleExecutionResult.rows.map(row => ({
            salesLeadId: row.sales_lead_id,
            salesLeadName: row.sales_lead_name,
            salesLeadEmail: row.sales_lead_email,
            executionEvaluationsCreated: parseInt(row.evaluations_created),
            avgExecutionScore: parseFloat(row.avg_execution_score) || 0,
            regionId: row.regionId,
            regionName: row.region_name
          })),
          
          // Sales lead coaching performance (of sales leads by regional managers)
          salesLeadCoachingPerformance: salesLeadCoachingResult.rows.map(row => ({
            salesLeadId: row.sales_lead_id,
            salesLeadName: row.sales_lead_name,
            salesLeadEmail: row.sales_lead_email,
            regionalManagerId: row.regional_manager_id,
            regionalManagerName: row.regional_manager_name,
            coachingEvaluationsReceived: parseInt(row.coaching_evaluations_received),
            avgCoachingScore: parseFloat(row.avg_coaching_score) || 0,
            regionId: row.regionId,
            regionName: row.region_name
          })),
          
          // Company execution metrics (salespeople evaluations)
          companyExecutionMetrics: companyExecutionResult.rows[0] ? {
            totalExecutionEvaluations: parseInt(companyExecutionResult.rows[0].total_execution_evaluations),
            avgExecutionScore: parseFloat(companyExecutionResult.rows[0].avg_execution_score) || 0,
            totalSalespeopleEvaluated: parseInt(companyExecutionResult.rows[0].total_salespeople_evaluated),
            totalSalesLeadsEvaluating: parseInt(companyExecutionResult.rows[0].total_sales_leads_evaluating)
          } : null,
          
          // Company coaching metrics (sales leads evaluations)
          companyCoachingMetrics: companyCoachingResult.rows[0] ? {
            totalCoachingEvaluations: parseInt(companyCoachingResult.rows[0].total_coaching_evaluations),
            avgCoachingScore: parseFloat(companyCoachingResult.rows[0].avg_coaching_score) || 0,
            totalSalesLeadsEvaluated: parseInt(companyCoachingResult.rows[0].total_sales_leads_evaluated),
            totalRegionalManagersEvaluating: parseInt(companyCoachingResult.rows[0].total_regional_managers_evaluating)
          } : null,
          
          // User counts
          userCounts: userCountsResult.rows[0] ? {
            totalSalesLeads: parseInt(userCountsResult.rows[0].total_sales_leads),
            totalRegionalManagers: parseInt(userCountsResult.rows[0].total_regional_managers),
            totalSalespeople: parseInt(userCountsResult.rows[0].total_salespeople)
          } : null,
          
          // Share of Wallet distribution
          shareOfWalletDistribution: shareOfWalletResult.rows.map(row => ({
            customerType: row.customer_type,
            evaluationCount: parseInt(row.evaluation_count),
            avgScore: parseFloat(row.avg_score) || 0,
            percentage: parseFloat(row.percentage) || 0
          })),
          
          // Execution trends (salespeople evaluations)
          executionTrends: executionTrendsResult.rows.map(row => ({
            date: row.evaluation_date,
            evaluationsCount: parseInt(row.evaluations_count),
            avgScore: parseFloat(row.avg_score) || 0
          })),
          
          // Coaching trends (sales leads evaluations)
          coachingTrends: coachingTrendsResult.rows.map(row => ({
            date: row.evaluation_date,
            evaluationsCount: parseInt(row.evaluations_count),
            avgScore: parseFloat(row.avg_score) || 0
          })),

          // Regional execution metrics (regional managers performance in sales behaviours)
          regionalExecutionMetrics: regionalExecutionMetricsResult.rows.map(row => ({
            regionalManagerId: row.regional_manager_id,
            regionalManagerName: row.regional_manager_name,
            regionalManagerEmail: row.regional_manager_email,
            regionId: row.regionId,
            regionName: row.region_name,
            executionEvaluations: parseInt(row.execution_evaluations),
            avgExecutionScore: parseFloat(row.avg_execution_score) || 0,
            uniqueSalespeopleEvaluated: parseInt(row.unique_salespeople_evaluated),
            uniqueSalesLeadsEvaluating: parseInt(row.unique_sales_leads_evaluating)
          })),

          // Regional coaching metrics (regional managers performance in coaching)
          regionalCoachingMetrics: regionalCoachingMetricsResult.rows.map(row => ({
            regionalManagerId: row.regional_manager_id,
            regionalManagerName: row.regional_manager_name,
            regionalManagerEmail: row.regional_manager_email,
            regionId: row.regionId,
            regionName: row.region_name,
            coachingEvaluations: parseInt(row.coaching_evaluations),
            avgCoachingScore: parseFloat(row.avg_coaching_score) || 0,
            uniqueSalesLeadsEvaluated: parseInt(row.unique_sales_leads_evaluated)
          }))
        };

        console.log(`✅ Returning dashboard data: ${dashboardData.regionalExecutionPerformance.length} execution regions, ${dashboardData.regionalCoachingPerformance.length} coaching regions, ${dashboardData.salespeopleExecutionPerformance.length} execution sales leads, ${dashboardData.salesLeadCoachingPerformance.length} coaching sales leads`);
        res.json(dashboardData);

      } catch (error) {
        console.error('❌ Error fetching director dashboard data:', error);
        res.status(500).json({ 
          message: 'Failed to fetch dashboard data', 
          error: error.message 
        });
      }
  }

  return { getDashboard, getTeam, getDirectorDashboard };
}

module.exports = { createAnalyticsHandlers };
