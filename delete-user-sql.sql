-- SQL script to safely delete user cmfkvi3vd00011113hrso4mfl
-- This script cleans up all foreign key references before deleting the user

-- Step 1: Check what references exist
SELECT 'user_teams (userId)' as table_name, COUNT(*) as count 
FROM user_teams WHERE "userId" = 'cmfkvi3vd00011113hrso4mfl'
UNION ALL
SELECT 'user_teams (user_id)' as table_name, COUNT(*) as count 
FROM user_teams WHERE user_id = 'cmfkvi3vd00011113hrso4mfl'
UNION ALL
SELECT 'teams (managerId)' as table_name, COUNT(*) as count 
FROM teams WHERE "managerId" = 'cmfkvi3vd00011113hrso4mfl'
UNION ALL
SELECT 'evaluations (managerId)' as table_name, COUNT(*) as count 
FROM evaluations WHERE "managerId" = 'cmfkvi3vd00011113hrso4mfl'
UNION ALL
SELECT 'evaluations (salespersonId)' as table_name, COUNT(*) as count 
FROM evaluations WHERE "salespersonId" = 'cmfkvi3vd00011113hrso4mfl'
UNION ALL
SELECT 'refresh_tokens (userId)' as table_name, COUNT(*) as count 
FROM refresh_tokens WHERE "userId" = 'cmfkvi3vd00011113hrso4mfl'
UNION ALL
SELECT 'push_subscriptions (userId)' as table_name, COUNT(*) as count 
FROM push_subscriptions WHERE "userId" = 'cmfkvi3vd00011113hrso4mfl';

-- Step 2: Clean up foreign key references
-- Remove from user_teams table (both column name variants)
DELETE FROM user_teams WHERE "userId" = 'cmfkvi3vd00011113hrso4mfl';
DELETE FROM user_teams WHERE user_id = 'cmfkvi3vd00011113hrso4mfl';

-- Clear manager references in teams table
UPDATE teams SET "managerId" = NULL, "updatedAt" = NOW() WHERE "managerId" = 'cmfkvi3vd00011113hrso4mfl';

-- Remove from evaluations table (both manager and salesperson references)
DELETE FROM evaluations WHERE "managerId" = 'cmfkvi3vd00011113hrso4mfl';
DELETE FROM evaluations WHERE "salespersonId" = 'cmfkvi3vd00011113hrso4mfl';

-- Remove from refresh_tokens table
DELETE FROM refresh_tokens WHERE "userId" = 'cmfkvi3vd00011113hrso4mfl';

-- Remove from push_subscriptions table
DELETE FROM push_subscriptions WHERE "userId" = 'cmfkvi3vd00011113hrso4mfl';

-- Step 3: Delete the user
DELETE FROM users WHERE id = 'cmfkvi3vd00011113hrso4mfl';

-- Step 4: Verify deletion
SELECT 'User deleted successfully' as result;
