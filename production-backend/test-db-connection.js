/**
 * Test database connection
 * Only reads data, no modifications
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function testConnection() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Testing database connection...\n');
    
    // Test 1: Simple query
    const test1 = await client.query('SELECT NOW() as current_time');
    console.log('✅ Connection successful');
    console.log(`   Current time: ${test1.rows[0].current_time}\n`);
    
    // Test 2: Check table counts (READ ONLY)
    const tables = ['users', 'evaluations', 'evaluation_items'];
    console.log('📊 Checking table row counts (READ ONLY):');
    
    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`   ${table.padEnd(20)}: ${result.rows[0].count} rows`);
      } catch (error) {
        console.log(`   ${table.padEnd(20)}: ERROR - ${error.message}`);
      }
    }
    
    console.log('\n✅ Database connection test completed successfully');
    return true;
    
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    return false;
  } finally {
    client.release();
    await pool.end();
  }
}

testConnection()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });

