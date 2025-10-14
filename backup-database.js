const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function backupDatabase() {
  console.log('📊 Starting database backup...');
  
  // Get database URL from AWS Secrets Manager
  let dbUrl;
  try {
    const secretOutput = execSync(
      'aws secretsmanager get-secret-value --secret-id sales-scorecard-db-url --region eu-north-1 --query SecretString --output text',
      { encoding: 'utf-8' }
    );
    dbUrl = secretOutput.trim();
    console.log('✅ Database URL retrieved from AWS Secrets Manager');
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
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupDir = path.join(process.env.HOME, `SalesScorecard-Backup-${timestamp}`, 'database');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Backup all tables
    const tables = ['User', 'Team', 'Evaluation', 'PushSubscription'];
    
    for (const table of tables) {
      console.log(`  - Backing up table: ${table}`);
      
      try {
        // Get table data
        const result = await client.query(`SELECT * FROM "${table}"`);
        
        // Save as JSON
        const jsonFile = path.join(backupDir, `${table}.json`);
        fs.writeFileSync(jsonFile, JSON.stringify(result.rows, null, 2));
        console.log(`    ✅ Saved ${result.rows.length} rows to ${table}.json`);
        
        // Save as SQL INSERT statements
        if (result.rows.length > 0) {
          const sqlFile = path.join(backupDir, `${table}.sql`);
          let sqlContent = `-- Table: ${table}\n-- Rows: ${result.rows.length}\n-- Date: ${new Date().toISOString()}\n\n`;
          
          // Get column names
          const columns = Object.keys(result.rows[0]);
          
          // Create INSERT statements
          for (const row of result.rows) {
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
          
          fs.writeFileSync(sqlFile, sqlContent);
          console.log(`    ✅ Saved SQL to ${table}.sql`);
        }
      } catch (error) {
        console.error(`    ❌ Failed to backup ${table}:`, error.message);
      }
    }
    
    // Get database schema
    console.log('  - Backing up database schema...');
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
    console.log('    ✅ Database URL saved');
    
    // Create restore script
    const restoreScript = `#!/bin/bash
# Database Restore Script
# Created: ${new Date().toISOString()}

echo "Restoring Sales Scorecard Database..."
echo "WARNING: This will restore data to the database!"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Restore cancelled"
  exit 1
fi

DB_URL=$(cat database-url.txt)

echo "Restoring tables..."
for table in User Team Evaluation PushSubscription; do
  echo "  - Restoring \${table}..."
  psql "\${DB_URL}" -f "\${table}.sql"
done

echo "✅ Database restore completed"
`;
    
    const restoreFile = path.join(backupDir, 'restore-database.sh');
    fs.writeFileSync(restoreFile, restoreScript);
    fs.chmodSync(restoreFile, '755');
    console.log('    ✅ Restore script created');
    
    console.log('');
    console.log('✅ Database backup completed successfully!');
    console.log(`📁 Backup location: ${backupDir}`);
    
  } catch (error) {
    console.error('❌ Database backup failed:', error);
  } finally {
    await client.end();
  }
}

backupDatabase();






