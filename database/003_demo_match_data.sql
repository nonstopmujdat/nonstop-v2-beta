-- NONSTOP demo data for operator page Supabase insert test
-- Run after 001_schema_v1_8.sql and 002_rls_starter.sql

INSERT INTO cities(id, name) VALUES (1, 'Bursa')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO seasons(id, name, start_date, end_date, is_active)
VALUES (1, '2026-2027', '2026-09-01', '2027-06-30', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = EXCLUDED.is_active;

INSERT INTO categories(id, name, gender) VALUES (1, 'U14', 'ERKEK')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, gender = EXCLUDED.gender;

INSERT INTO organizations(id, city_id, season_id, category_id, name, organization_type)
VALUES (1, 1, 1, 1, 'NONSTOP Demo Ligi', 'LIG')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO venues(id, city_id, name)
VALUES (1, 1, 'Demo Salon')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO clubs(id, city_id, name, short_name) VALUES
(1, 1, 'TOFAŞ U14', 'TOFAŞ'),
(2, 1, 'GEMLİK U14', 'GEMLİK')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, short_name = EXCLUDED.short_name;

INSERT INTO teams(id, club_id, category_id, season_id, name) VALUES
(1, 1, 1, 1, 'TOFAŞ U14'),
(2, 2, 1, 1, 'GEMLİK U14')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO players(id, license_no, jersey_no, first_name, last_name, position) VALUES
(1, 'DEMO-7', 7, 'Burak', 'Demo', 'G'),
(2, 'DEMO-4', 4, 'Ahmet', 'Demo', 'G'),
(3, 'DEMO-5', 5, 'Mehmet', 'Demo', 'F'),
(4, 'DEMO-6', 6, 'Ali', 'Demo', 'F'),
(5, 'DEMO-8', 8, 'Kerem', 'Demo', 'C'),
(6, 'DEMO-9', 9, 'Ege', 'Demo', 'G'),
(7, 'DEMO-10', 10, 'Okan', 'Demo', 'G'),
(8, 'DEMO-11', 11, 'Mert', 'Demo', 'F'),
(9, 'DEMO-12', 12, 'Can', 'Demo', 'F'),
(10, 'DEMO-13', 13, 'Tuna', 'Demo', 'C'),
(11, 'DEMO-14', 14, 'Emir', 'Demo', 'F'),
(12, 'DEMO-15', 15, 'Arda', 'Demo', 'G')
ON CONFLICT (id) DO UPDATE SET jersey_no = EXCLUDED.jersey_no, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name;

INSERT INTO player_team_registrations(player_id, team_id, season_id, is_active)
SELECT id, 1, 1, true FROM players WHERE id BETWEEN 1 AND 12
ON CONFLICT DO NOTHING;

INSERT INTO matches(id, organization_id, home_team_id, away_team_id, venue_id, match_datetime, status, match_type, home_score, away_score, current_quarter, clock_seconds, stats_mode)
VALUES (1, 1, 1, 2, 1, NOW(), 'DEVAM_EDIYOR', 'OZEL', 52, 47, 4, 204, 'SINGLE')
ON CONFLICT (id) DO UPDATE SET home_team_id = EXCLUDED.home_team_id, away_team_id = EXCLUDED.away_team_id, status = EXCLUDED.status;

-- Reset sequences so future auto IDs continue safely after demo IDs
SELECT setval(pg_get_serial_sequence('cities','id'), GREATEST((SELECT MAX(id) FROM cities), 1));
SELECT setval(pg_get_serial_sequence('seasons','id'), GREATEST((SELECT MAX(id) FROM seasons), 1));
SELECT setval(pg_get_serial_sequence('categories','id'), GREATEST((SELECT MAX(id) FROM categories), 1));
SELECT setval(pg_get_serial_sequence('organizations','id'), GREATEST((SELECT MAX(id) FROM organizations), 1));
SELECT setval(pg_get_serial_sequence('venues','id'), GREATEST((SELECT MAX(id) FROM venues), 1));
SELECT setval(pg_get_serial_sequence('clubs','id'), GREATEST((SELECT MAX(id) FROM clubs), 1));
SELECT setval(pg_get_serial_sequence('teams','id'), GREATEST((SELECT MAX(id) FROM teams), 1));
SELECT setval(pg_get_serial_sequence('players','id'), GREATEST((SELECT MAX(id) FROM players), 1));
SELECT setval(pg_get_serial_sequence('matches','id'), GREATEST((SELECT MAX(id) FROM matches), 1));
