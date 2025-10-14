const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function backupDatabase() {
  console.log('📊 Starting comprehensive database backup...');
  
  // Get database URL from AWS Secrets Manager
  let dbUrl;
  try {
    const secretOutput = execSync(
      'aws secretsmanager get-secret-value --secret-id sales-scorecard-db-url --region eu-north-1 --query SecretString --output text',
      { encoding: 'utf-8' }
    );
    dbUrl = secretOutput.trim();
    console.log('✅ Database URL retrieved');
  } catch (error) {
    console.error('❌ Failed to get database URL:', error.message);
    process.exit(1);
  }
  
  // Connect to database
  const client = new Client({
    connectionString: dbUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Create backup directory
    const backupDir = path.join(process.env.HOME, 'SalesScorecard-Backup-20250930-113603', 'database');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Get all tables in the database
    console.log('  - Discovering tables...');
    const tablesResult = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);
    
    const tables = tablesResult.rows.map(row => row.tablename);
    console.log(`  - Found ${tables.length} tables:`, tables.join(', '));
    
    // Backup each table
    let totalRows = 0;
    const backupSummary = {};
    
    for (const table of tables) {
      console.log(`\n  📋 Backing up table: ${table}`);
      
      try {
        // Get table data
        const result = await client.query(`SELECT * FROM "${table}"`);
        const rowCount = result.rows.length;
        totalRows += rowCount;
        
        // Save as JSON
        const jsonFile = path.join(backupDir, `${table}.json`);
        fs.writeFileSync(jsonFile, JSON.stringify(result.rows, null, 2));
        console.log(`    ✅ JSON: ${rowCount} rows`);
        
        // Save as SQL INSERT statements (if there's data)
        if (rowCount > 0) {
          const sqlFile = path.join(backupDir, `${table}.sql`);
          let sqlContent = `-- Table: ${table}\n-- Rows: ${rowCount}\n-- Date: ${new Date().toISOString()}\n\n`;
          sqlContent += `-- Disable triggers for faster restore\nALTER TABLE "${table}" DISABLE TRIGGER ALL;\n\n`;
          
          // Get column names
          const columns = Object.keys(result.rows[0]);
          
          // Create INSERT statements (batch of 100)
          for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows[i];
            const values = columns.map(col => {
              const val = row[col];
              if (val === null) return 'NULL';
              if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
              if (val instanceof Date) return `'${val.toISOString()}'`;
              if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
              if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
              return val;
            });
            
            sqlContent += `INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});\n`;
          }
          
          sqlContent += `\n-- Re-enable triggers\nALTER TABLE "${table}" ENABLE TRIGGER ALL;\n`;
          
          fs.writeFileSync(sqlFile, sqlContent);
          console.log(`    ✅ SQL: ${rowCount} INSERT statements`);
        }
        
        backupSummary[table] = rowCount;
        
      } catch (error) {
        console.error(`    ❌ Failed to backup ${table}:`, error.message);
        backupSummary[table] = `Error: ${error.message}`;
      }
    }
    
    // Get database schema
    console.log('\n  🏗️  Backing up database schema...');
    const schemaResult = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `);
    
    const schemaFile = path.join(backupDir, 'schema-info.json');
    fs.writeFileSync(schemaFile, JSON.stringify(schemaResult.rows, null, 2));
    console.log('    ✅ Schema information saved');
    
    // Save database URL
    const dbUrlFile = path.join(backupDir, 'database-url.txt');
    fs.writeFileSync(dbUrlFile, dbUrl);
    
    // Create summary
    const summaryFile = path.join(backupDir, 'BACKUP-SUMMARY.md');
    let summary = `# Database Backup Summary\n\n`;
    summary += `**Date:** ${new Date().toISOString()}\n`;
    summary += `**Total Tables:** ${tables.length}\n`;
    summary += `**Total Rows:** ${totalRows}\n\n`;
    summary += `## Tables:\n\n`;
    
    for (const [table, rows] of Object.entries(backupSummary)) {
      summary += `- **${table}**: ${rows} rows\n`;
    }
    
    summary += `\n## Files Created:\n\n`;
    summary += `- \`database-url.txt\` - Database connection URL\n`;
    summary += `- \`schema-info.json\` - Complete schema information\n`;
    summary += `- \`restore-database.sh\` - Restore script\n`;
    summary += `- \`<table>.json\` - JSON data for each table\n`;
    summary += `- \`<table>.sql\` - SQL INSERT statements for each table\n`;
    
    fs.writeFileSync(summaryFile, summary);
    
    console.log('\n==========================================');
    console.log('✅ DATABASE BACKUP COMPLETED');
    console.log('==========================================');
    console.log(`📁 Location: ${backupDir}`);
    console.log(`📊 Tables: ${tables.length}`);
    console.log(`📝 Total Rows: ${totalRows}`);
    console.log('==========================================\n');
    
  } catch (error) {
    console.error('❌ Database backup failed:', error);
  } finally {
    await client.end();
  }
}

backupDatabase();






