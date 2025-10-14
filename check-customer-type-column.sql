-- Check if customerType column exists in evaluations table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'evaluations' 
AND column_name = 'customerType';



