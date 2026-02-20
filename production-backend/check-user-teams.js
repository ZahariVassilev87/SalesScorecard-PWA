/**
 * Check user_teams table structure and data
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:SalesScorecard2024!@sales-scorecard-db.cvmwi48oaptu.eu-north-1.rds.amazonaws.com:5432/sales_scorecard',
  ssl: { rejectUnauthorized: false }
});

async function checkUserTeams() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking user_teams table...\n');
    
    // Check if table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_teams'
      );
    `);
    
    console.log('Table exists:', tableExists.rows[0].exists);
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ user_teams table does not exist');
      return;
    }
    
    // Get table structure
    console.log('\n📋 Table structure:');
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'user_teams'
      ORDER BY ordinal_position;
    `);
    
    console.log('Columns:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });
    
    // Check row count
    console.log('\n📊 Row count:');
    const count = await client.query('SELECT COUNT(*) as count FROM user_teams');
    console.log(`  Total rows: ${count.rows[0].count}`);
    
    // Get sample data (if any)
    if (parseInt(count.rows[0].count) > 0) {
      console.log('\n📋 Sample data (first 10 rows):');
      const data = await client.query('SELECT * FROM user_teams LIMIT 10');
      console.log(JSON.stringify(data.rows, null, 2));
    } else {
      console.log('\n⚠️  Table is empty - no data found');
    }
    
    // Check related tables
    console.log('\n🔗 Checking related data:');
    
    // Check users
    const usersCount = await client.query('SELECT COUNT(*) as count FROM users');
    console.log(`  Users: ${usersCount.rows[0].count}`);
    
    // Check teams
    const teamsCount = await client.query('SELECT COUNT(*) as count FROM teams');
    console.log(`  Teams: ${teamsCount.rows[0].count}`);
    
    // Check if there are users with team relationships in other ways
    console.log('\n🔍 Checking for team relationships in users table:');
    const usersWithTeams = await client.query(`
      SELECT id, email, "displayName", role, "companyId"
      FROM users
      WHERE role IN ('SALES_LEAD', 'SALESPERSON', 'REGIONAL_SALES_MANAGER')
      LIMIT 10
    `);
    console.log(`  Sample users: ${usersWithTeams.rows.length}`);
    if (usersWithTeams.rows.length > 0) {
      console.log('  First user:', usersWithTeams.rows[0]);
    }
    
    // Check teams structure
    console.log('\n📋 Teams structure:');
    const teamsColumns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'teams'
      ORDER BY ordinal_position;
    `);
    console.log('Teams columns:');
    teamsColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
    
    // Check if teams have managerId
    console.log('\n👥 Teams with managers:');
    const teamsWithManagers = await client.query(`
      SELECT id, name, "managerId", "regionId"
      FROM teams
      WHERE "managerId" IS NOT NULL
      LIMIT 5
    `);
    console.log(`  Teams with managers: ${teamsWithManagers.rows.length}`);
    if (teamsWithManagers.rows.length > 0) {
      teamsWithManagers.rows.forEach(team => {
        console.log(`    - ${team.name} (manager: ${team.managerId})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkUserTeams()
  .then(() => {
    console.log('\n✅ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });

