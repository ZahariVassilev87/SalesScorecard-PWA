/**
 * Complete Database Backup Script
 * Backs up all users, evaluations, evaluation_items, and related data
 * Creates both JSON and SQL backup files
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DEFAULT_DATABASE_URL = 'postgresql://postgres:SalesScorecard2024!@sales-scorecard-db.cvmwi48oaptu.eu-north-1.rds.amazonaws.com:5432/sales_scorecard';
const connectionString =
  process.env.DATABASE_URL ||
  process.env.PRODUCTION_DATABASE_URL ||
  DEFAULT_DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
});

// Tables to backup (in order of dependencies)
const TABLES_TO_BACKUP = [
  'users',
  'regions',
  'teams',
  'user_teams',
  'user_regions',
  'behavior_categories',
  'behavior_items',
  'evaluations',
  'evaluation_items',
  'audit_logs'
];

async function backupTable(client, tableName) {
  try {
    // First check if createdAt column exists
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1 
      AND column_name IN ('createdAt', 'id')
      ORDER BY CASE column_name WHEN 'createdAt' THEN 1 WHEN 'id' THEN 2 END
    `, [tableName]);
    
    const hasCreatedAt = columnCheck.rows.some(row => row.column_name === 'createdAt');
    const hasId = columnCheck.rows.some(row => row.column_name === 'id');
    
    // Build ORDER BY clause based on available columns
    let orderBy = '';
    if (hasCreatedAt) {
      orderBy = 'ORDER BY "createdAt" ASC, id ASC';
    } else if (hasId) {
      orderBy = 'ORDER BY id ASC';
    }
    
    // Get all data from table
    const result = await client.query(`SELECT * FROM ${tableName} ${orderBy}`);
    
    // Get column names
    const columns = result.rows.length > 0 ? Object.keys(result.rows[0]) : [];
    
    return {
      table: tableName,
      columns: columns,
      rowCount: result.rows.length,
      data: result.rows
    };
  } catch (error) {
    console.error(`❌ Error backing up table ${tableName}:`, error.message);
    return {
      table: tableName,
      columns: [],
      rowCount: 0,
      data: [],
      error: error.message
    };
  }
}

async function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupDir = path.join(__dirname, 'backups');
  
  // Create backup directory if it doesn't exist
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const backupName = `backup-${timestamp}`;
  const backupPath = path.join(backupDir, backupName);
  
  // Create backup directory
  fs.mkdirSync(backupPath, { recursive: true });
  
  const client = await pool.connect();
  
  try {
    console.log('📦 Starting database backup...\n');
    
    const backup = {
      timestamp: new Date().toISOString(),
      database: process.env.DATABASE_URL ? 'production' : 'unknown',
      tables: {}
    };
    
    // Backup each table
    for (const tableName of TABLES_TO_BACKUP) {
      console.log(`📋 Backing up table: ${tableName}...`);
      const tableData = await backupTable(client, tableName);
      backup.tables[tableName] = tableData;
      console.log(`   ✅ ${tableData.rowCount} rows backed up${tableData.error ? ' (with errors)' : ''}`);
    }
    
    // Save JSON backup
    const jsonPath = path.join(backupPath, 'backup.json');
    fs.writeFileSync(jsonPath, JSON.stringify(backup, null, 2), 'utf8');
    console.log(`\n💾 JSON backup saved: ${jsonPath}`);
    
    // Save SQL backup (for easy restore)
    const sqlPath = path.join(backupPath, 'backup.sql');
    let sqlContent = `-- Database Backup\n`;
    sqlContent += `-- Created: ${backup.timestamp}\n`;
    sqlContent += `-- Database: ${backup.database}\n\n`;
    sqlContent += `BEGIN;\n\n`;
    
    for (const tableName of TABLES_TO_BACKUP) {
      const tableData = backup.tables[tableName];
      
      if (tableData.error || tableData.rowCount === 0) {
        sqlContent += `-- Table: ${tableName} (${tableData.rowCount} rows${tableData.error ? ` - ERROR: ${tableData.error}` : ''})\n`;
        continue;
      }
      
      sqlContent += `-- Table: ${tableName} (${tableData.rowCount} rows)\n`;
      
      if (tableData.rowCount > 0) {
        // Create INSERT statements
        for (const row of tableData.data) {
          const columns = tableData.columns.map(col => `"${col}"`).join(', ');
          const values = tableData.columns.map(col => {
            const value = row[col];
            if (value === null || value === undefined) return 'NULL';
            if (typeof value === 'string') {
              // Escape single quotes and backslashes
              return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
            }
            if (value instanceof Date) {
              return `'${value.toISOString()}'::timestamp`;
            }
            if (typeof value === 'boolean') {
              return value ? 'true' : 'false';
            }
            if (typeof value === 'number') {
              return value.toString();
            }
            if (typeof value === 'object') {
              // Handle JSON objects
              return `'${JSON.stringify(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'::jsonb`;
            }
            return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
          }).join(', ');
          
          // Use ON CONFLICT only if id column exists
          const hasId = tableData.columns.includes('id');
          if (hasId) {
            sqlContent += `INSERT INTO ${tableName} (${columns}) VALUES (${values}) ON CONFLICT (id) DO NOTHING;\n`;
          } else {
            sqlContent += `INSERT INTO ${tableName} (${columns}) VALUES (${values});\n`;
          }
        }
      }
      
      sqlContent += `\n`;
    }
    
    sqlContent += `COMMIT;\n`;
    fs.writeFileSync(sqlPath, sqlContent, 'utf8');
    console.log(`💾 SQL backup saved: ${sqlPath}`);
    
    // Create summary file
    const summaryPath = path.join(backupPath, 'summary.txt');
    let summary = `Database Backup Summary\n`;
    summary += `=====================\n\n`;
    summary += `Timestamp: ${backup.timestamp}\n`;
    summary += `Database: ${backup.database}\n\n`;
    summary += `Tables Backed Up:\n`;
    summary += `-----------------\n`;
    
    let totalRows = 0;
    for (const tableName of TABLES_TO_BACKUP) {
      const tableData = backup.tables[tableName];
      totalRows += tableData.rowCount;
      summary += `${tableName.padEnd(25)}: ${String(tableData.rowCount).padStart(6)} rows`;
      if (tableData.error) {
        summary += ` (ERROR: ${tableData.error})`;
      }
      summary += `\n`;
    }
    
    summary += `\nTotal Rows: ${totalRows}\n`;
    summary += `\nFiles:\n`;
    summary += `  - backup.json: Complete JSON backup\n`;
    summary += `  - backup.sql: SQL INSERT statements for restore\n`;
    summary += `  - summary.txt: This file\n`;
    
    fs.writeFileSync(summaryPath, summary, 'utf8');
    console.log(`📄 Summary saved: ${summaryPath}`);
    
    // Print summary
    console.log(`\n${summary}`);
    console.log(`\n✅ Backup completed successfully!`);
    console.log(`📁 Backup location: ${backupPath}\n`);
    
    return {
      success: true,
      backupPath: backupPath,
      summary: {
        timestamp: backup.timestamp,
        totalRows: totalRows,
        tables: Object.keys(backup.tables).reduce((acc, table) => {
          acc[table] = backup.tables[table].rowCount;
          return acc;
        }, {})
      }
    };
    
  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run backup
createBackup()
  .then((result) => {
    console.log('✅ Backup script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Backup script failed:', error);
    process.exit(1);
  });

