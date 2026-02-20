/**
 * Script to CHECK evaluations with overallScore = 0 or null
 * This shows what can be fixed and what needs to be deleted
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkZeroScores() {
  const client = await pool.connect();
  
  try {
    // Find evaluations with overallScore = 0 or null
    const evaluationsResult = await client.query(`
      SELECT 
        e.id, 
        e."salespersonId", 
        e."overallScore",
        e."createdAt",
        e."managerId",
        sp.email as salesperson_email,
        sp."displayName" as salesperson_name,
        mg.email as manager_email,
        mg."displayName" as manager_name
      FROM evaluations e
      LEFT JOIN users sp ON sp.id = e."salespersonId"
      LEFT JOIN users mg ON mg.id = e."managerId"
      WHERE e."overallScore" IS NULL OR e."overallScore" = 0
      ORDER BY e."createdAt" DESC
    `);
    
    console.log(`\n📊 Found ${evaluationsResult.rows.length} evaluations with null or 0 overallScore\n`);
    
    let canFix = 0;
    let mustDelete = 0;
    const fixable = [];
    const deletable = [];
    
    for (const eval of evaluationsResult.rows) {
      // Get all items for this evaluation
      const itemsResult = await client.query(`
        SELECT rating, "behaviorItemId"
        FROM evaluation_items
        WHERE "evaluationId" = $1
      `, [eval.id]);
      
      if (itemsResult.rows.length === 0) {
        // No items - must delete
        mustDelete++;
        deletable.push({
          id: eval.id,
          reason: 'No items',
          salesperson: eval.salesperson_name || eval.salesperson_email,
          manager: eval.manager_name || eval.manager_email,
          createdAt: eval.createdAt
        });
        continue;
      }
      
      // Check if all items have valid scores (1-4)
      const validScores = itemsResult.rows.filter(item => item.rating >= 1 && item.rating <= 4);
      const invalidScores = itemsResult.rows.filter(item => !item.rating || item.rating < 1 || item.rating > 4);
      
      if (validScores.length === 0) {
        // All items have invalid scores - must delete
        mustDelete++;
        deletable.push({
          id: eval.id,
          reason: `All ${itemsResult.rows.length} items have invalid scores`,
          salesperson: eval.salesperson_name || eval.salesperson_email,
          manager: eval.manager_name || eval.manager_email,
          createdAt: eval.createdAt,
          invalidItems: invalidScores.length
        });
        continue;
      }
      
      // Can be fixed - has valid scores
      canFix++;
      const totalScore = validScores.reduce((sum, item) => sum + item.rating, 0);
      const newOverallScore = Math.round((totalScore / validScores.length) * 100) / 100;
      
      fixable.push({
        id: eval.id,
        currentScore: eval.overallScore,
        newScore: newOverallScore,
        validItems: validScores.length,
        totalItems: itemsResult.rows.length,
        salesperson: eval.salesperson_name || eval.salesperson_email,
        manager: eval.manager_name || eval.manager_email,
        createdAt: eval.createdAt
      });
    }
    
    console.log(`✅ CAN BE FIXED: ${canFix} evaluations (have valid scores in items)`);
    console.log(`❌ MUST BE DELETED: ${mustDelete} evaluations (no valid scores)\n`);
    
    if (fixable.length > 0) {
      console.log('📋 Evaluations that CAN be fixed:');
      fixable.forEach(eval => {
        console.log(`  ✅ ${eval.id}`);
        console.log(`     Salesperson: ${eval.salesperson}`);
        console.log(`     Manager: ${eval.manager}`);
        console.log(`     Current: ${eval.currentScore} → New: ${eval.newScore}`);
        console.log(`     Valid items: ${eval.validItems}/${eval.totalItems}`);
        console.log(`     Created: ${eval.createdAt}`);
        console.log('');
      });
    }
    
    if (deletable.length > 0) {
      console.log('🗑️  Evaluations that MUST be deleted:');
      deletable.forEach(eval => {
        console.log(`  ❌ ${eval.id}`);
        console.log(`     Salesperson: ${eval.salesperson}`);
        console.log(`     Manager: ${eval.manager}`);
        console.log(`     Reason: ${eval.reason}`);
        console.log(`     Created: ${eval.createdAt}`);
        console.log('');
      });
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Can fix: ${canFix}`);
    console.log(`   ❌ Must delete: ${mustDelete}`);
    console.log(`   📝 Total: ${evaluationsResult.rows.length}\n`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

checkZeroScores()
  .then(() => {
    console.log('✅ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });

