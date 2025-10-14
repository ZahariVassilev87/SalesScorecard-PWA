#!/usr/bin/env node

/**
 * Complete Database Backup Script
 * Creates a comprehensive backup of the PostgreSQL database
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'scorecard',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

// Alternative: Use DATABASE_URL if available
const databaseUrl = process.env.DATABASE_URL;

async function createDatabaseBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = `database-backups`;
  const backupFile = path.join(backupDir, `database-backup-${timestamp}.sql`);
  
  console.log('🗄️  Starting database backup...');
  console.log(`📅 Timestamp: ${timestamp}`);
  console.log(`📁 Backup file: ${backupFile}`);
  
  // Create backup directory
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  let client;
  
  try {
    // Connect to database
    if (databaseUrl) {
      console.log('🔗 Connecting using DATABASE_URL...');
      client = new Client({ connectionString: databaseUrl });
    } else {
      console.log('🔗 Connecting using individual config...');
      client = new Client(dbConfig);
    }
    
    await client.connect();
    console.log('✅ Connected to database successfully');
    
    // Get database info
    const dbInfo = await client.query(`
      SELECT 
        current_database() as database_name,
        version() as version,
        current_user as current_user,
        inet_server_addr() as server_address,
        inet_server_port() as server_port
    `);
    
    console.log('📊 Database Info:');
    console.log(`  - Database: ${dbInfo.rows[0].database_name}`);
    console.log(`  - Version: ${dbInfo.rows[0].version.split(' ')[0]}`);
    console.log(`  - User: ${dbInfo.rows[0].current_user}`);
    console.log(`  - Server: ${dbInfo.rows[0].server_address}:${dbInfo.rows[0].server_port}`);
    
    // Get table information
    const tables = await client.query(`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        pg_stat_get_live_tup(c.oid) as row_count
      FROM pg_tables pt
      JOIN pg_class c ON c.relname = pt.tablename
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `);
    
    console.log('\n📋 Tables:');
    tables.rows.forEach(table => {
      console.log(`  - ${table.tablename}: ${table.size} (${table.row_count} rows)`);
    });
    
    // Create backup content
    let backupContent = `-- Database Backup
-- Generated: ${new Date().toISOString()}
-- Database: ${dbInfo.rows[0].database_name}
-- Version: ${dbInfo.rows[0].version}
-- User: ${dbInfo.rows[0].current_user}

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Disable triggers during restore
SET session_replication_role = replica;

`;

    // Get schema (DDL)
    console.log('\n📝 Creating schema backup...');
    const schema = await client.query(`
      SELECT 
        'CREATE TABLE ' || schemaname || '.' || tablename || ' (' ||
        string_agg(
          column_name || ' ' || data_type ||
          CASE WHEN character_maximum_length IS NOT NULL 
               THEN '(' || character_maximum_length || ')' 
               ELSE '' END ||
          CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
          CASE WHEN column_default IS NOT NULL 
               THEN ' DEFAULT ' || column_default 
               ELSE '' END,
          ', '
        ) || ');' as create_statement
      FROM information_schema.columns
      WHERE table_schema = 'public'
      GROUP BY schemaname, tablename
      ORDER BY tablename
    `);
    
    backupContent += '-- Schema (DDL)\n';
    backupContent += '-- ==============\n\n';
    schema.rows.forEach(row => {
      backupContent += row.create_statement + '\n\n';
    });
    
    // Get indexes
    console.log('📝 Creating indexes backup...');
    const indexes = await client.query(`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `);
    
    if (indexes.rows.length > 0) {
      backupContent += '-- Indexes\n';
      backupContent += '-- =======\n\n';
      indexes.rows.forEach(index => {
        backupContent += index.indexdef + ';\n\n';
      });
    }
    
    // Get data for each table
    console.log('📝 Creating data backup...');
    backupContent += '-- Data (DML)\n';
    backupContent += '-- ==========\n\n';
    
    for (const table of tables.rows) {
      const tableName = table.tablename;
      console.log(`  - Backing up table: ${tableName}`);
      
      try {
        const data = await client.query(`SELECT * FROM ${tableName} ORDER BY id`);
        
        if (data.rows.length > 0) {
          // Get column names
          const columns = Object.keys(data.rows[0]);
          const columnList = columns.join(', ');
          
          backupContent += `-- Data for table: ${tableName}\n`;
          backupContent += `INSERT INTO ${tableName} (${columnList}) VALUES\n`;
          
          const values = data.rows.map(row => {
            const rowValues = columns.map(col => {
              const value = row[col];
              if (value === null) return 'NULL';
              if (typeof value === 'string') {
                // Escape single quotes
                return `'${value.replace(/'/g, "''")}'`;
              }
              if (value instanceof Date) {
                return `'${value.toISOString()}'`;
              }
              if (typeof value === 'boolean') {
                return value ? 'true' : 'false';
              }
              if (typeof value === 'object') {
                return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
              }
              return value;
            });
            return `(${rowValues.join(', ')})`;
          });
          
          backupContent += values.join(',\n') + ';\n\n';
          
          console.log(`    ✅ ${data.rows.length} rows backed up`);
        } else {
          console.log(`    ⚠️  Table ${tableName} is empty`);
          backupContent += `-- Table ${tableName} is empty\n\n`;
        }
      } catch (error) {
        console.log(`    ❌ Error backing up table ${tableName}: ${error.message}`);
        backupContent += `-- Error backing up table ${tableName}: ${error.message}\n\n`;
      }
    }
    
    // Re-enable triggers
    backupContent += `
-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- Backup completed
-- ================
`;

    // Write backup file
    fs.writeFileSync(backupFile, backupContent);
    
    // Get file size
    const stats = fs.statSync(backupFile);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log(`\n✅ Database backup completed successfully!`);
    console.log(`📁 Backup file: ${backupFile}`);
    console.log(`📊 File size: ${fileSizeMB} MB`);
    
    // Create restore script
    const restoreScript = `#!/bin/bash
# Database Restore Script
# Generated: ${new Date().toISOString()}

echo "🔄 Restoring database from backup..."

# Check if backup file exists
if [ ! -f "${backupFile}" ]; then
    echo "❌ Backup file not found: ${backupFile}"
    exit 1
fi

# Database connection (edit these variables as needed)
DB_HOST="${dbConfig.host}"
DB_PORT="${dbConfig.port}"
DB_NAME="${dbConfig.database}"
DB_USER="${dbConfig.user}"
DB_PASSWORD="${dbConfig.password}"

# Use DATABASE_URL if available
if [ -n "$DATABASE_URL" ]; then
    echo "🔗 Using DATABASE_URL for connection..."
    psql "$DATABASE_URL" < "${backupFile}"
else
    echo "🔗 Using individual config for connection..."
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "${backupFile}"
fi

if [ $? -eq 0 ]; then
    echo "✅ Database restored successfully!"
else
    echo "❌ Database restore failed!"
    exit 1
fi
`;

    const restoreScriptFile = path.join(backupDir, `restore-database-${timestamp}.sh`);
    fs.writeFileSync(restoreScriptFile, restoreScript);
    fs.chmodSync(restoreScriptFile, '755');
    
    console.log(`📄 Restore script: ${restoreScriptFile}`);
    
    // Create backup manifest
    const manifest = {
      timestamp: timestamp,
      database: dbInfo.rows[0].database_name,
      version: dbInfo.rows[0].version,
      user: dbInfo.rows[0].current_user,
      server: `${dbInfo.rows[0].server_address}:${dbInfo.rows[0].server_port}`,
      tables: tables.rows.map(t => ({
        name: t.tablename,
        size: t.size,
        rows: parseInt(t.row_count)
      })),
      backupFile: backupFile,
      restoreScript: restoreScriptFile,
      fileSizeMB: parseFloat(fileSizeMB)
    };
    
    const manifestFile = path.join(backupDir, `backup-manifest-${timestamp}.json`);
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
    
    console.log(`📋 Manifest: ${manifestFile}`);
    console.log(`\n🎉 Database backup process completed!`);
    
  } catch (error) {
    console.error('❌ Database backup failed:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

// Run the backup
if (require.main === module) {
  createDatabaseBackup().catch(error => {
    console.error('❌ Backup script failed:', error);
    process.exit(1);
  });
}

module.exports = { createDatabaseBackup };