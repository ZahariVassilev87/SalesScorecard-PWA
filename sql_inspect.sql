-- List schemas
SELECT schema_name FROM information_schema.schemata ORDER BY schema_name;

-- Current database and schema
SELECT current_database() AS db, current_schema() AS schema;

-- List tables in public
SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;

-- Columns for key tables
SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('users','teams','user_teams','regions') ORDER BY table_name, ordinal_position;

-- Check constraints/indexes for teams
SELECT c.relname AS table_name, i.relname AS index_name, a.amname AS index_type
FROM pg_class c
JOIN pg_index x ON c.oid = x.indrelid
JOIN pg_class i ON x.indexrelid = i.oid
JOIN pg_am a ON i.relam = a.oid
WHERE c.relname in ('users','teams','user_teams','regions');
