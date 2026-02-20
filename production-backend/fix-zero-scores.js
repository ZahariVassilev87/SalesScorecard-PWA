/**
 * Script to fix evaluations with overallScore = 0 or null
 * This recalculates overallScore from evaluation_items
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function fixZeroScores() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Find evaluations with overallScore = 0 or null
    const evaluationsResult = await client.query(`
      SELECT id, "salespersonId", "overallScore"
      FROM evaluations
      WHERE "overallScore" IS NULL OR "overallScore" = 0
      ORDER BY "createdAt" DESC
    `);
    
    console.log(`Found ${evaluationsResult.rows.length} evaluations with null or 0 overallScore`);
    
    let fixed = 0;
    let deleted = 0;
    
    for (const eval of evaluationsResult.rows) {
      // Get all items for this evaluation
      const itemsResult = await client.query(`
        SELECT rating
        FROM evaluation_items
        WHERE "evaluationId" = $1
      `, [eval.id]);
      
      if (itemsResult.rows.length === 0) {
        // No items - this is an invalid evaluation, delete it
        console.log(`  ❌ Evaluation ${eval.id} has no items - DELETING`);
        await client.query('DELETE FROM evaluations WHERE id = $1', [eval.id]);
        deleted++;
        continue;
      }
      
      // Check if all items have valid scores (1-4)
      const validScores = itemsResult.rows.filter(item => item.rating >= 1 && item.rating <= 4);
      
      if (validScores.length === 0) {
        // All items have invalid scores (0 or null) - delete evaluation
        console.log(`  ❌ Evaluation ${eval.id} has no valid scores - DELETING`);
        await client.query('DELETE FROM evaluations WHERE id = $1', [eval.id]);
        await client.query('DELETE FROM evaluation_items WHERE "evaluationId" = $1', [eval.id]);
        deleted++;
        continue;
      }
      
      // Recalculate overallScore from valid items
      const totalScore = validScores.reduce((sum, item) => sum + item.rating, 0);
      const newOverallScore = Math.round((totalScore / validScores.length) * 100) / 100;
      
      console.log(`  ✅ Evaluation ${eval.id}: Recalculating from ${validScores.length} items, new score: ${newOverallScore}`);
      
      await client.query(`
        UPDATE evaluations
        SET "overallScore" = $1, "updatedAt" = NOW()
        WHERE id = $2
      `, [newOverallScore, eval.id]);
      
      fixed++;
    }
    
    await client.query('COMMIT');
    
    console.log(`\n✅ Fixed ${fixed} evaluations`);
    console.log(`🗑️  Deleted ${deleted} invalid evaluations`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixZeroScores()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

