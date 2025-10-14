const { Pool } = require('pg');
const fs = require('fs');

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/sales_scorecard',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigrations() {
  try {
    console.log('🔄 Running database migrations...');
    
    // Read the SQL file
    const sql = fs.readFileSync('./fix-database.sql', 'utf8');
    
    // Execute the SQL
    await pool.query(sql);
    
    console.log('✅ Database migrations completed successfully');
    
    // Test the isActive column
    const testResult = await pool.query('SELECT id, email, "displayName", role, "isActive" FROM users LIMIT 3');
    console.log('✅ Test query successful:', testResult.rows);
    
  } catch (error) {
    console.error('❌ Error running migrations:', error);
  } finally {
    await pool.end();
  }
}

runMigrations();

