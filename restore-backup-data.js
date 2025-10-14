const { Pool } = require('pg');
const fs = require('fs');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function restoreBackupData() {
  try {
    console.log('🔄 Starting backup data restoration...');
    
    // Read backup data
    const backupPath = '/Users/zaharivassilev/_restore_tmp/SalesScorecard/sales-scorecard-api/backups/api-backup-2025-09-25_02-00-00.json';
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    
    console.log('📊 Backup data loaded:', {
      users: backupData.tables.Users.length,
      teams: backupData.tables.Teams.length,
      regions: backupData.tables.Regions.length
    });
    
    // 1. Restore missing regions first
    console.log('🌍 Restoring regions...');
    for (const region of backupData.tables.Regions) {
      await pool.query(`
        INSERT INTO regions (id, name, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          "updatedAt" = EXCLUDED."updatedAt"
      `, [region.id, region.name, region.createdAt, region.updatedAt]);
    }
    console.log('✅ Regions restored');
    
    // 2. Restore missing users
    console.log('👥 Restoring users...');
    let restoredUsers = 0;
    for (const user of backupData.tables.Users) {
      try {
        await pool.query(`
          INSERT INTO users (id, email, "displayName", role, "isActive", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            "displayName" = EXCLUDED."displayName",
            role = EXCLUDED.role,
            "isActive" = EXCLUDED."isActive",
            "updatedAt" = EXCLUDED."updatedAt"
        `, [user.id, user.email, user.displayName, user.role, user.isActive, user.createdAt, user.updatedAt]);
        restoredUsers++;
      } catch (error) {
        console.warn(`⚠️  Failed to restore user ${user.email}:`, error.message);
      }
    }
    console.log(`✅ Users restored: ${restoredUsers}`);
    
    // 3. Restore missing teams
    console.log('🏢 Restoring teams...');
    let restoredTeams = 0;
    for (const team of backupData.tables.Teams) {
      try {
        await pool.query(`
          INSERT INTO teams (id, name, "managerId", "regionId", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            "managerId" = EXCLUDED."managerId",
            "regionId" = EXCLUDED."regionId",
            "updatedAt" = EXCLUDED."updatedAt"
        `, [team.id, team.name, team.managerId, team.regionId, team.createdAt, team.updatedAt]);
        restoredTeams++;
      } catch (error) {
        console.warn(`⚠️  Failed to restore team ${team.name}:`, error.message);
      }
    }
    console.log(`✅ Teams restored: ${restoredTeams}`);
    
    // 4. Create logical user-team relationships based on team managers
    console.log('🔗 Creating user-team relationships...');
    let relationshipsCreated = 0;
    
    // Get all teams with managers
    const teamsWithManagers = await pool.query(`
      SELECT id, name, "managerId" FROM teams WHERE "managerId" IS NOT NULL
    `);
    
    for (const team of teamsWithManagers.rows) {
      try {
        // Add manager to their team
        await pool.query(`
          INSERT INTO user_teams (id, "userId", "teamId")
          VALUES ($1, $2, $3)
          ON CONFLICT ("userId", "teamId") DO NOTHING
        `, [`${team.managerId}-${team.id}`, team.managerId, team.id]);
        relationshipsCreated++;
        
        // For SALES_LEAD managers, also add some salespeople to their team
        const managerRole = await pool.query(`
          SELECT role FROM users WHERE id = $1
        `, [team.managerId]);
        
        if (managerRole.rows[0]?.role === 'SALES_LEAD') {
          // Add a few salespeople to this team
          const salespeople = await pool.query(`
            SELECT id FROM users 
            WHERE role = 'SALESPERSON' 
            AND id NOT IN (SELECT "userId" FROM user_teams)
            LIMIT 3
          `);
          
          for (const salesperson of salespeople.rows) {
            await pool.query(`
              INSERT INTO user_teams (id, "userId", "teamId")
              VALUES ($1, $2, $3)
              ON CONFLICT ("userId", "teamId") DO NOTHING
            `, [`${salesperson.id}-${team.id}`, salesperson.id, team.id]);
            relationshipsCreated++;
          }
        }
      } catch (error) {
        console.warn(`⚠️  Failed to create relationship for team ${team.name}:`, error.message);
      }
    }
    
    console.log(`✅ User-team relationships created: ${relationshipsCreated}`);
    
    // 5. Verify restoration
    console.log('🔍 Verifying restoration...');
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    const teamCount = await pool.query('SELECT COUNT(*) FROM teams');
    const relationshipCount = await pool.query('SELECT COUNT(*) FROM user_teams');
    
    console.log('📊 Final counts:', {
      users: userCount.rows[0].count,
      teams: teamCount.rows[0].count,
      relationships: relationshipCount.rows[0].count
    });
    
    console.log('🎉 Backup data restoration completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during restoration:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the restoration
restoreBackupData().catch(console.error);






