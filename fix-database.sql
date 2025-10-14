-- Add isActive column to users table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'isActive'
  ) THEN
    ALTER TABLE users ADD COLUMN "isActive" BOOLEAN DEFAULT true;
    CREATE INDEX IF NOT EXISTS idx_users_is_active ON users ("isActive");
    RAISE NOTICE 'Added isActive column to users table';
  END IF;
END $$;

-- Update existing users with default isActive = true if they don't have one
UPDATE users 
SET "isActive" = true 
WHERE "isActive" IS NULL;

-- Add customerType column to evaluations table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'evaluations' 
    AND column_name = 'customerType'
  ) THEN
    ALTER TABLE evaluations ADD COLUMN "customerType" VARCHAR(50) DEFAULT 'LOW_SHARE';
    CREATE INDEX IF NOT EXISTS idx_evaluations_customer_type ON evaluations ("customerType");
    RAISE NOTICE 'Added customerType column to evaluations table';
  END IF;
END $$;

-- Update existing evaluations with default customerType if they don't have one
UPDATE evaluations 
SET "customerType" = 'LOW_SHARE' 
WHERE "customerType" IS NULL;

