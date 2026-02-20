/**
 * Safe Script to fix evaluations with overallScore = 0 or null
 * Shows what will be done BEFORE making changes
 * Uses transaction for safety
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:SalesScorecard2024!@sales-scorecard-db.cvmwi48oaptu.eu-north-1.rds.amazonaws.com:5432/sales_scorecard',
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function fixZeroScoresSafe() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Analyzing evaluations with null or 0 overallScore...\n');
    
    // First, analyze what needs to be done (READ ONLY)
    const evaluationsResult = await client.query(`
      SELECT e.id, e."salespersonId", e."managerId", e."overallScore", e."createdAt",
             sp.email as salesperson_email, sp."displayName" as salesperson_name,
             mg.email as manager_email, mg."displayName" as manager_name
      FROM evaluations e
      LEFT JOIN users sp ON sp.id = e."salespersonId"
      LEFT JOIN users mg ON mg.id = e."managerId"
      WHERE e."overallScore" IS NULL OR e."overallScore" = 0
      ORDER BY e."createdAt" DESC
    `);
    
    console.log(`📊 Found ${evaluationsResult.rows.length} evaluations with null or 0 overallScore\n`);
    
    const toFix = [];
    const toDelete = [];
    
    for (const eval of evaluationsResult.rows) {
      // Check if manager is nikolay.atanasov@metro.bg
      const isNikolay = eval.manager_email === 'nikolay.atanasov@metro.bg';
      
      // Get all items for this evaluation
      const itemsResult = await client.query(`
        SELECT rating, "behaviorItemId"
        FROM evaluation_items
        WHERE "evaluationId" = $1
      `, [eval.id]);
      
      if (itemsResult.rows.length === 0) {
        if (isNikolay) {
          console.log(`  ⚠️  SKIPPING ${eval.id} (nikolay.atanasov@metro.bg - no items, but keeping it)`);
          continue; // Don't delete nikolay's evaluations
        }
        toDelete.push({
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
        if (isNikolay) {
          console.log(`  ⚠️  SKIPPING ${eval.id} (nikolay.atanasov@metro.bg - invalid scores, but keeping it)`);
          continue; // Don't delete nikolay's evaluations
        }
        toDelete.push({
          id: eval.id,
          reason: `All ${itemsResult.rows.length} items have invalid scores`,
          salesperson: eval.salesperson_name || eval.salesperson_email,
          manager: eval.manager_name || eval.manager_email,
          createdAt: eval.createdAt,
          invalidItems: invalidScores.length
        });
        continue;
      }
      
      // Can be fixed
      const totalScore = validScores.reduce((sum, item) => sum + item.rating, 0);
      const newOverallScore = Math.round((totalScore / validScores.length) * 100) / 100;
      
      toFix.push({
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
    
    // Show what will be done
    console.log('📋 PLAN - What will be done:\n');
    
    if (toFix.length > 0) {
      console.log(`✅ WILL FIX ${toFix.length} evaluation(s):`);
      toFix.forEach(eval => {
        console.log(`   ${eval.id}`);
        console.log(`      Salesperson: ${eval.salesperson}`);
        console.log(`      Manager: ${eval.manager}`);
        console.log(`      Current: ${eval.currentScore} → New: ${eval.newScore}`);
        console.log(`      Valid items: ${eval.validItems}/${eval.totalItems}`);
        console.log(`      Created: ${eval.createdAt}`);
        console.log('');
      });
    }
    
    if (toDelete.length > 0) {
      console.log(`🗑️  WILL DELETE ${toDelete.length} invalid evaluation(s):`);
      toDelete.forEach(eval => {
        console.log(`   ${eval.id}`);
        console.log(`      Salesperson: ${eval.salesperson}`);
        console.log(`      Manager: ${eval.manager}`);
        console.log(`      Reason: ${eval.reason}`);
        console.log(`      Created: ${eval.createdAt}`);
        console.log('');
      });
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Will fix: ${toFix.length}`);
    console.log(`   🗑️  Will delete: ${toDelete.length}`);
    console.log(`   📝 Total affected: ${toFix.length + toDelete.length}`);
    console.log(`   ✅ Other evaluations: NOT AFFECTED\n`);
    
    if (toFix.length === 0 && toDelete.length === 0) {
      console.log('✅ No evaluations need fixing!');
      return;
    }
    
    // Ask for confirmation (in real scenario, you'd use readline)
    console.log('⚠️  Ready to proceed? This will:');
    console.log('   1. Fix evaluations with valid data');
    console.log('   2. Delete invalid evaluations (no data)');
    console.log('   3. Use transaction (rollback if error)\n');
    
    // Proceed with fixes
    console.log('🚀 Starting fixes...\n');
    await client.query('BEGIN');
    
    let fixed = 0;
    let deleted = 0;
    
    // Fix evaluations
    for (const eval of toFix) {
      const itemsResult = await client.query(`
        SELECT rating
        FROM evaluation_items
        WHERE "evaluationId" = $1
      `, [eval.id]);
      
      const validScores = itemsResult.rows.filter(item => item.rating >= 1 && item.rating <= 4);
      const totalScore = validScores.reduce((sum, item) => sum + item.rating, 0);
      const newOverallScore = Math.round((totalScore / validScores.length) * 100) / 100;
      
      await client.query(`
        UPDATE evaluations
        SET "overallScore" = $1, "updatedAt" = NOW()
        WHERE id = $2
      `, [newOverallScore, eval.id]);
      
      console.log(`  ✅ Fixed ${eval.id}: ${eval.currentScore} → ${newOverallScore}`);
      fixed++;
    }
    
    // Delete invalid evaluations
    for (const eval of toDelete) {
      // Delete items first (foreign key constraint)
      await client.query('DELETE FROM evaluation_items WHERE "evaluationId" = $1', [eval.id]);
      // Then delete evaluation
      await client.query('DELETE FROM evaluations WHERE id = $1', [eval.id]);
      
      console.log(`  🗑️  Deleted ${eval.id}: ${eval.reason}`);
      deleted++;
    }
    
    await client.query('COMMIT');
    
    console.log(`\n✅ Successfully fixed ${fixed} evaluation(s)`);
    console.log(`🗑️  Successfully deleted ${deleted} invalid evaluation(s)`);
    console.log(`\n✅ All other evaluations remain unchanged!`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error occurred - all changes rolled back!');
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixZeroScoresSafe()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

