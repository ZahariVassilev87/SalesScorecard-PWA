// Script to add customerType column to production database
const { Pool } = require('pg');
const fs = require('fs');

// Database connection from environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function addCustomerTypeColumn() {
  try {
    console.log('🔄 Connecting to database...');
    
    // Read SQL file
    const sql = fs.readFileSync('./add-customer-type-column.sql', 'utf8');
    
    console.log('📝 Executing SQL to add customerType column...');
    const result = await pool.query(sql);
    
    console.log('✅ Successfully added customerType column!');
    console.log('Result:', result);
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

addCustomerTypeColumn();




