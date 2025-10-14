-- Restore missing users from backup
INSERT INTO users (id, email, "displayName", role, "isActive", "createdAt", "updatedAt")
VALUES 
  ('cmfw7n4s0000a10sv2zkqs8g8', 'jan@metro.bg', 'Jan', 'SALES_DIRECTOR', true, '2025-09-15T08:00:00.000Z', '2025-09-15T08:00:00.000Z'),
  ('cmfzc8pk00007rv7h3erazq8f', 'jean@company.com', 'Jean', 'SALES_LEAD', true, '2025-09-15T08:00:00.000Z', '2025-09-15T08:00:00.000Z'),
  ('cmfo74g5o0004xh47l5d8nf49', 'rosen.katsarov@instorm.bg', 'Rosen', 'REGIONAL_SALES_MANAGER', true, '2025-09-15T08:00:00.000Z', '2025-09-15T08:00:00.000Z'),
  ('cmfzchq0v000brv7hpdhtfd78', 'george@company.com', 'George', 'SALESPERSON', true, '2025-09-15T08:00:00.000Z', '2025-09-15T08:00:00.000Z'),
  ('cmfzch1yj000arv7hvrrfze80', 'vladimir@company.com', 'Vladimir', 'SALESPERSON', true, '2025-09-15T08:00:00.000Z', '2025-09-15T08:00:00.000Z'),
  ('cmfzc5vv50000rv7hpj6ts3x5', 'krasimir@company.com', 'Krasimir', 'REGIONAL_SALES_MANAGER', true, '2025-09-15T08:00:00.000Z', '2025-09-15T08:00:00.000Z'),
  ('cmfz2lwck00006sgnaia9galb', 'maria@company.com', 'Maria', 'SALES_LEAD', true, '2025-09-15T08:00:00.000Z', '2025-09-15T08:00:00.000Z'),
  ('cmfz1dg540022tqzuzebeq9je', 'mihail@company.com', 'Mihail', 'SALESPERSON', true, '2025-09-15T08:00:00.000Z', '2025-09-15T08:00:00.000Z'),
  ('cmfz1cvgq0021tqzuh8iy74iw', 'georgi@instorm.com', 'Georgi', 'SALESPERSON', true, '2025-09-15T08:00:00.000Z', '2025-09-15T08:00:00.000Z'),
  ('cmfz1awbm001stqzu80l09ord', 'alexander@company.com', 'Alexander', 'SALESPERSON', true, '2025-09-15T08:00:00.000Z', '2025-09-15T08:00:00.000Z'),
  ('cmfz1aen7001rtqzu8jj8z212', 'petar@company.com', 'Petar', 'SALESPERSON', true, '2025-09-15T08:00:00.000Z', '2025-09-15T08:00:00.000Z'),
  ('cmfz17nke001gtqzu28khan4q', 'ivan@company.com', 'Ivan', 'SALES_LEAD', true, '2025-09-15T08:00:00.000Z', '2025-09-15T08:00:00.000Z'),
  ('cmfz1729p001ftqzua4ugjp5i', 'nikolai@company.com', 'Nikolai', 'SALES_LEAD', true, '2025-09-15T08:00:00.000Z', '2025-09-15T08:00:00.000Z'),
  ('cmfxnujdz0000mykhve7q9r1a', 'ts.peycheva@gmail.com', 'Cveti', 'REGIONAL_SALES_MANAGER', true, '2025-09-15T08:00:00.000Z', '2025-09-15T08:00:00.000Z')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  "displayName" = EXCLUDED."displayName",
  role = EXCLUDED.role,
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = EXCLUDED."updatedAt";

-- Restore missing teams from backup
INSERT INTO teams (id, name, "managerId", "regionId", "createdAt", "updatedAt")
VALUES 
  ('cmfo8me9r001ail2udrfjqgbt', 'Enterprise Sales', 'cmfo74g5o0004xh47l5d8nf49', 'cmfkt5iqj0002i3xdq86vmyfz', '2025-09-15T08:00:00.000Z', '2025-09-15T08:00:00.000Z'),
  ('cmftoemq40001sstn4nso84ch', 'Unassigned', null, 'cmfkt5iqj0002i3xdq86vmyfz', '2025-09-15T08:00:00.000Z', '2025-09-15T08:00:00.000Z'),
  ('cmfwg7t0c00016jjdf749qfqr', 'Jans Team', null, 'cmfkt5iqj0002i3xdq86vmyfz', '2025-09-15T08:00:00.000Z', '2025-09-15T08:00:00.000Z'),
  ('cmftpe23x00013cgm5xzshztl', 'Rosens Team', 'cmfo74g5o0004xh47l5d8nf49', 'cmfkt5iqj0002i3xdq86vmyfz', '2025-09-15T08:00:00.000Z', '2025-09-15T08:00:00.000Z'),
  ('cmfzcibnr000drv7hzu4oldzr', 'Marias Team', 'cmfz2lwck00006sgnaia9galb', 'cmfkt5iqj0002i3xdq86vmyfz', '2025-09-15T08:00:00.000Z', '2025-09-15T08:00:00.000Z'),
  ('cmfzc6td20002rv7hsqsiko7j', 'Krasimirs Team', 'cmfzc5vv50000rv7hpj6ts3x5', 'cmfkt5iqj0002i3xdq86vmyfz', '2025-09-15T08:00:00.000Z', '2025-09-15T08:00:00.000Z'),
  ('cmfz1bv9m001ytqzuppcvl5iq', 'Nikolais team', 'cmfz1729p001ftqzua4ugjp5i', 'cmfkt5iqj0002i3xdq86vmyfz', '2025-09-15T08:00:00.000Z', '2025-09-15T08:00:00.000Z'),
  ('cmfz18q93001mtqzuo2qp4p16', 'Ivans team', 'cmfz17nke001gtqzu28khan4q', 'cmfkt5iqj0002i3xdq86vmyfz', '2025-09-15T08:00:00.000Z', '2025-09-15T08:00:00.000Z'),
  ('cmfyi8ax1001ctqzu52lk2ja0', 'cvetis team', 'cmfxnujdz0000mykhve7q9r1a', 'cmfkt5iqj0002i3xdq86vmyfz', '2025-09-15T08:00:00.000Z', '2025-09-15T08:00:00.000Z')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  "managerId" = EXCLUDED."managerId",
  "regionId" = EXCLUDED."regionId",
  "updatedAt" = EXCLUDED."updatedAt";

-- Create user-team relationships
INSERT INTO user_teams (id, "userId", "teamId")
VALUES 
  -- Rosen's team (Enterprise Sales)
  ('rosen-enterprise', 'cmfo74g5o0004xh47l5d8nf49', 'cmfo8me9r001ail2udrfjqgbt'),
  ('rosen-rosens', 'cmfo74g5o0004xh47l5d8nf49', 'cmftpe23x00013cgm5xzshztl'),
  
  -- Maria's team
  ('maria-team', 'cmfz2lwck00006sgnaia9galb', 'cmfzcibnr000drv7hzu4oldzr'),
  
  -- Krasimir's team
  ('krasimir-team', 'cmfzc5vv50000rv7hpj6ts3x5', 'cmfzc6td20002rv7hsqsiko7j'),
  
  -- Nikolai's team
  ('nikolai-team', 'cmfz1729p001ftqzua4ugjp5i', 'cmfz1bv9m001ytqzuppcvl5iq'),
  
  -- Ivan's team
  ('ivan-team', 'cmfz17nke001gtqzu28khan4q', 'cmfz18q93001mtqzuo2qp4p16'),
  
  -- Cveti's team
  ('cveti-team', 'cmfxnujdz0000mykhve7q9r1a', 'cmfyi8ax1001ctqzu52lk2ja0'),
  
  -- Add some salespeople to teams
  ('george-maria', 'cmfzchq0v000brv7hpdhtfd78', 'cmfzcibnr000drv7hzu4oldzr'),
  ('vladimir-krasimir', 'cmfzch1yj000arv7hvrrfze80', 'cmfzc6td20002rv7hsqsiko7j'),
  ('mihail-nikolai', 'cmfz1dg540022tqzuzebeq9je', 'cmfz1bv9m001ytqzuppcvl5iq'),
  ('georgi-ivan', 'cmfz1cvgq0021tqzuh8iy74iw', 'cmfz18q93001mtqzuo2qp4p16'),
  ('alexander-cveti', 'cmfz1awbm001stqzu80l09ord', 'cmfyi8ax1001ctqzu52lk2ja0'),
  ('petar-rosen', 'cmfz1aen7001rtqzu8jj8z212', 'cmftpe23x00013cgm5xzshztl')
ON CONFLICT ("userId", "teamId") DO NOTHING;






