-- Add customerType column to evaluations table if it doesn't exist
DO $$ 
BEGIN
    -- Check if column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'evaluations' 
        AND column_name = 'customerType'
    ) THEN
        -- Add the column
        ALTER TABLE evaluations 
        ADD COLUMN "customerType" VARCHAR(50);
        
        RAISE NOTICE 'Added customerType column to evaluations table';
    ELSE
        RAISE NOTICE 'customerType column already exists in evaluations table';
    END IF;
END $$;

-- Update existing evaluations with default customerType if they don't have one
UPDATE evaluations 
SET "customerType" = 'LOW_SHARE' 
WHERE "customerType" IS NULL;

-- Show the result
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'evaluations' 
AND column_name = 'customerType';



