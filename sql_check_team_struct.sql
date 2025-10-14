SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('teams','user_teams','users') ORDER BY table_name, ordinal_position;
SELECT 'teams_exists' AS check, EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='teams' AND table_schema='public');
SELECT 'user_teams_exists' AS check, EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='user_teams' AND table_schema='public');
-- Sample rows
SELECT 'teams_sample' AS tag, * FROM teams LIMIT 5;
SELECT 'user_teams_sample' AS tag, * FROM user_teams LIMIT 5;
