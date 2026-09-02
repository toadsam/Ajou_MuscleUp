-- 합성 데이터 제거 (PostgreSQL).
--
-- seed_200k.sql 이 넣은 것만 지운다. 표시는 두 가지다 —
--   users.email LIKE 'bench+%@bench.local'   (그 회원과 그 회원을 참조하는 행)
--   program_applications.goal LIKE '__BENCH__%'  (회원과 무관한 표)
--
-- 실제 회원 데이터는 이 조건에 걸리지 않는다. 그래도 운영 DB 에서는 돌리지 말 것.
--
-- 쓰는 법
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/sql/bench/cleanup.sql

\set ON_ERROR_STOP on

\echo '=== 지우기 전 확인 ==='
SELECT 'bench users' AS what, count(*) FROM users WHERE email LIKE 'bench+%@bench.local'
UNION ALL SELECT 'bench program_applications', count(*) FROM program_applications WHERE goal LIKE '\_\_BENCH\_\_%';

BEGIN;

-- 자식부터 지운다. FK 가 걸려 있어 순서를 바꾸면 실패한다.
DELETE FROM brag_media WHERE brag_id IN (
    SELECT bp.id FROM brag_post bp
    JOIN users u ON u.id = bp.user_id
    WHERE u.email LIKE 'bench+%@bench.local'
);

DELETE FROM brag_post WHERE user_id IN (
    SELECT id FROM users WHERE email LIKE 'bench+%@bench.local'
);

DELETE FROM character_profiles WHERE user_id IN (
    SELECT id FROM users WHERE email LIKE 'bench+%@bench.local'
);

DELETE FROM attendance_logs WHERE user_id IN (
    SELECT id FROM users WHERE email LIKE 'bench+%@bench.local'
);

DELETE FROM program_applications WHERE goal LIKE '\_\_BENCH\_\_%';

DELETE FROM users WHERE email LIKE 'bench+%@bench.local';

COMMIT;

ANALYZE users;
ANALYZE brag_post;
ANALYZE character_profiles;
ANALYZE attendance_logs;
ANALYZE program_applications;

\echo ''
\echo '=== 지운 뒤 남은 행 ==='
SELECT 'users' AS table_name, count(*) FROM users
UNION ALL SELECT 'brag_post', count(*) FROM brag_post
UNION ALL SELECT 'character_profiles', count(*) FROM character_profiles
UNION ALL SELECT 'attendance_logs', count(*) FROM attendance_logs
UNION ALL SELECT 'program_applications', count(*) FROM program_applications;
