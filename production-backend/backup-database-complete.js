#!/usr/bin/env node

/**
 * COMPREHENSIVE DATABASE BACKUP SCRIPT
 * Creates a complete backup of all database data and structure
 * Date: 2025-10-01-040444
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/sales_scorecard'
});

const BACKUP_DIR = path.join(__dirname, 'backups', 'database');
const TIMESTAMP = '20251001-040444';

async function createBackupDirectory() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

async function backupTableStructure() {
  console.log('📋 Backing up database structure...');
  
  const structureQuery = `
    SELECT 
      schemaname,
      tablename,
      tableowner,
      hasindexes,
      hasrules,
      hastriggers
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `;
  
  const result = await pool.query(structureQuery);
  
  const structure = {
    timestamp: new Date().toISOString(),
    schema: 'public',
    tables: result.rows
  };
  
  fs.writeFileSync(
    path.join(BACKUP_DIR, `database-structure-${TIMESTAMP}.json`),
    JSON.stringify(structure, null, 2)
  );
  
  console.log(`✅ Database structure backed up: ${result.rows.length} tables`);
}

async function backupTableData() {
  console.log('💾 Backing up table data...');
  
  const tables = [
    'users', 'teams', 'regions', 'evaluations', 'evaluation_items', 
    'behavior_items', 'behavior_categories', 'refresh_tokens'
  ];
  
  const allData = {};
  
  for (const table of tables) {
    try {
      const result = await pool.query(`SELECT * FROM ${table} ORDER BY id`);
      allData[table] = result.rows;
      console.log(`  ✅ ${table}: ${result.rows.length} records`);
    } catch (error) {
      console.log(`  ❌ ${table}: Error - ${error.message}`);
      allData[table] = [];
    }
  }
  
  const dataBackup = {
    timestamp: new Date().toISOString(),
    tables: allData,
    totalRecords: Object.values(allData).reduce((sum, records) => sum + records.length, 0)
  };
  
  fs.writeFileSync(
    path.join(BACKUP_DIR, `database-data-${TIMESTAMP}.json`),
    JSON.stringify(dataBackup, null, 2)
  );
  
  console.log(`✅ Database data backed up: ${dataBackup.totalRecords} total records`);
}

async function backupConstraintsAndIndexes() {
  console.log('🔗 Backing up constraints and indexes...');
  
  const constraintsQuery = `
    SELECT 
      tc.table_name,
      tc.constraint_name,
      tc.constraint_type,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    LEFT JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_type;
  `;
  
  const result = await pool.query(constraintsQuery);
  
  const constraints = {
    timestamp: new Date().toISOString(),
    constraints: result.rows
  };
  
  fs.writeFileSync(
    path.join(BACKUP_DIR, `database-constraints-${TIMESTAMP}.json`),
    JSON.stringify(constraints, null, 2)
  );
  
  console.log(`✅ Constraints backed up: ${result.rows.length} constraints`);
}

async function generateRestoreScript() {
  console.log('📜 Generating restore script...');
  
  const restoreScript = `#!/usr/bin/env node

/**
 * DATABASE RESTORE SCRIPT
 * Restores database from backup files
 * Generated: ${new Date().toISOString()}
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/sales_scorecard'
});

const BACKUP_DIR = path.join(__dirname, 'database');
const TIMESTAMP = '${TIMESTAMP}';

async function restoreData() {
  try {
    console.log('🔄 Starting database restore...');
    
    // Read data backup
    const dataPath = path.join(BACKUP_DIR, \`database-data-\${TIMESTAMP}.json\`);
    const dataBackup = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // Clear existing data
    const tables = Object.keys(dataBackup.tables);
    for (const table of tables) {
      await pool.query(\`DELETE FROM \${table}\`);
      console.log(\`  🗑️  Cleared \${table}\`);
    }
    
    // Restore data
    for (const [table, records] of Object.entries(dataBackup.tables)) {
      if (records.length === 0) continue;
      
      const columns = Object.keys(records[0]);
      const values = records.map(record => 
        columns.map(col => record[col])
      );
      
      const placeholders = columns.map((_, i) => \`$\${i + 1}\`).join(', ');
      const insertQuery = \`
        INSERT INTO \${table} (\${columns.join(', ')})
        VALUES \${values.map(() => \`(\${placeholders})\`).join(', ')}
        ON CONFLICT (id) DO UPDATE SET
        \${columns.filter(col => col !== 'id').map(col => \`\${col} = EXCLUDED.\${col}\`).join(', ')}
      \`;
      
      await pool.query(insertQuery, values.flat());
      console.log(\`  ✅ Restored \${table}: \${records.length} records\`);
    }
    
    console.log('🎉 Database restore completed successfully!');
    
  } catch (error) {
    console.error('❌ Restore failed:', error);
  } finally {
    await pool.end();
  }
}

restoreData();
`;
  
  fs.writeFileSync(
    path.join(BACKUP_DIR, `restore-database-${TIMESTAMP}.js`),
    restoreScript
  );
  
  fs.chmodSync(path.join(BACKUP_DIR, `restore-database-${TIMESTAMP}.js`), '755');
  
  console.log('✅ Restore script generated');
}

async function main() {
  try {
    console.log('🚀 Starting comprehensive database backup...');
    console.log(`📅 Timestamp: ${TIMESTAMP}`);
    
    await createBackupDirectory();
    await backupTableStructure();
    await backupTableData();
    await backupConstraintsAndIndexes();
    await generateRestoreScript();
    
    console.log('🎉 Database backup completed successfully!');
    console.log(`📁 Backup location: ${BACKUP_DIR}`);
    
  } catch (error) {
    console.error('❌ Backup failed:', error);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
