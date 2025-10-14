-- SQL script to safely anonymize user cmfkvi3vd00011113hrso4mfl
-- This approach is safer than deletion as it preserves data integrity

-- Step 1: Anonymize the user (deactivate and change email/name)
UPDATE users 
SET 
  email = 'deleted+cmfkvi3vd00011113hrso4mfl@instorm.io',
  "displayName" = 'Deleted User',
  "isActive" = false,
  role = 'SALESPERSON',
  "updatedAt" = NOW()
WHERE id = 'cmfkvi3vd00011113hrso4mfl';

-- Step 2: Verify anonymization
SELECT id, email, "displayName", "isActive", role, "updatedAt" 
FROM users 
WHERE id = 'cmfkvi3vd00011113hrso4mfl';

-- Result should show:
-- email: deleted+cmfkvi3vd00011113hrso4mfl@instorm.io
-- displayName: Deleted User
-- isActive: false
-- role: SALESPERSON
