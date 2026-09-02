-- 목록 인덱스 실험용 합성 데이터 (PostgreSQL).
--
-- 왜: 지금 회원은 약 50명이라 어떤 목록도 느리지 않다. 인덱스가 필요한지,
--     넣으면 얼마나 빨라지는지는 **행이 쌓인 뒤에야** 보인다. 그래서 표당
--     20만 행을 만들어 두고 EXPLAIN 으로 재는 것이 이 스크립트의 목적이다.
--
-- 무엇을: 아래 네 목록 화면을 받치는 표에 각각 20만 행.
--     brag_post            자랑방 목록        ORDER BY created_at DESC
--     character_profiles   공개 캐릭터 랭킹    WHERE is_public ORDER BY level DESC, updated_at DESC
--     attendance_logs      공유 인증 관리      WHERE shared ORDER BY report_count DESC, updated_at DESC
--     program_applications 프로그램 신청 목록   ORDER BY created_at DESC
--
-- 안전장치
--   * 넣는 행은 전부 표시가 남는다 — users.email 이 'bench+...@bench.local',
--     나머지는 그 회원을 참조하거나 goal='__BENCH__' 다. cleanup.sql 이 그것만 지운다.
--   * 운영 DB 에서 절대 돌리지 말 것. 로컬/임시 DB 전용이다.
--   * character_profiles 는 user_id 가 UNIQUE 고 attendance_logs 는
--     (user_id, workout_date) 가 UNIQUE 라, 20만 행을 만들려면 회원도 20만 명이
--     있어야 한다. 그래서 회원부터 만든다.
--
-- 쓰는 법
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/sql/bench/seed_200k.sql
--   (기본 20만 행. 줄이려면 아래 :rows 를 -v rows=50000 처럼 넘긴다)

\set ON_ERROR_STOP on
\if :{?rows}
\else
  \set rows 200000
\endif

\echo '=== 합성 데이터 생성 시작 (행 수: ' :rows ') ==='

BEGIN;

-- ── 1. 회원 ─────────────────────────────────────────────────────────────────
-- 비밀번호는 로그인에 쓰지 않는 더미다(bcrypt 형식만 흉내). 이 계정으로는
-- 로그인이 되지 않는다 — 어차피 지우는 데이터다.
INSERT INTO users (name, email, password, role, nickname, created_at)
SELECT
    'bench' || g,
    'bench+' || g || '@bench.local',
    '$2a$10$benchbenchbenchbenchbenchbenchbenchbenchbenchbenchbenchbe',
    'USER',
    'bench' || g,
    NOW() - (g || ' minutes')::interval
FROM generate_series(1, :rows) AS g
ON CONFLICT (email) DO NOTHING;

\echo '  users 완료'

-- ── 2. 자랑방 글 ────────────────────────────────────────────────────────────
-- created_at 을 흩어 놓는다. 전부 같은 시각이면 정렬 비용이 사라져 실험이 무의미해진다.
INSERT INTO brag_post (user_id, title, content, movement, weight, visibility, created_at, updated_at)
SELECT
    u.id,
    '벤치 글 ' || u.id,
    '합성 데이터입니다. 인덱스 실험용으로 만든 행이라 화면에서 볼 일은 없습니다.',
    CASE (u.id % 3) WHEN 0 THEN '벤치프레스' WHEN 1 THEN '스쿼트' ELSE '데드리프트' END,
    ((u.id % 80) + 40) || 'kg',
    'PUBLIC',
    NOW() - ((u.id % 500000) || ' seconds')::interval,
    NOW() - ((u.id % 500000) || ' seconds')::interval
FROM users u
WHERE u.email LIKE 'bench+%@bench.local';

\echo '  brag_post 완료'

-- ── 3. 캐릭터 프로필 ────────────────────────────────────────────────────────
-- is_public 을 약 70% 만 true 로 둔다. 전부 true 면 필터가 무의미해져서
-- 「필터 컬럼을 인덱스 맨 앞에 둔다」는 판단을 검증할 수 없다.
INSERT INTO character_profiles
    (user_id, level, tier, evolution_stage, title, is_public, attendance_points, is_resting, created_at, updated_at)
SELECT
    u.id,
    1 + (u.id % 99),
    CASE (u.id % 3) WHEN 0 THEN 'BRONZE' WHEN 1 THEN 'SILVER' ELSE 'GOLD' END,
    u.id % 9,
    '벤치',
    (u.id % 10) < 7,
    u.id % 500,
    false,
    NOW() - ((u.id % 500000) || ' seconds')::interval,
    NOW() - ((u.id % 500000) || ' seconds')::interval
FROM users u
WHERE u.email LIKE 'bench+%@bench.local'
ON CONFLICT (user_id) DO NOTHING;

\echo '  character_profiles 완료'

-- ── 4. 출석/인증 기록 ───────────────────────────────────────────────────────
-- shared 는 약 40%. report_count 는 0 에 몰리게 두되 일부만 크게 — 실제 신고
-- 분포와 비슷해야 「신고 많은 순」 정렬이 의미가 있다.
INSERT INTO attendance_logs
    (user_id, workout_date, did_workout, shared, cheer_count, report_count, hidden_by_admin, created_at, updated_at)
SELECT
    u.id,
    CURRENT_DATE - (u.id % 365),
    true,
    (u.id % 10) < 4,
    u.id % 50,
    CASE WHEN (u.id % 97) = 0 THEN (u.id % 40) ELSE 0 END,
    false,
    NOW() - ((u.id % 500000) || ' seconds')::interval,
    NOW() - ((u.id % 500000) || ' seconds')::interval
FROM users u
WHERE u.email LIKE 'bench+%@bench.local'
ON CONFLICT (user_id, workout_date) DO NOTHING;

\echo '  attendance_logs 완료'

-- ── 5. 프로그램 신청 ────────────────────────────────────────────────────────
-- 이 표만 회원과 무관하다. goal 에 표시를 남겨 cleanup 이 찾을 수 있게 한다.
INSERT INTO program_applications (name, email, goal, track, commitment, status, created_at, updated_at)
SELECT
    'bench' || g,
    'bench+' || g || '@bench.local',
    '__BENCH__ 합성 신청',
    CASE (g % 3) WHEN 0 THEN 'STRENGTH' WHEN 1 THEN 'DIET' ELSE 'HEALTH' END,
    '주 3회',
    'PENDING',
    NOW() - ((g % 500000) || ' seconds')::interval,
    NOW() - ((g % 500000) || ' seconds')::interval
FROM generate_series(1, :rows) AS g;

\echo '  program_applications 완료'

COMMIT;

-- 통계를 갱신하지 않으면 플래너가 옛 추정치로 계획을 세운다.
-- 이걸 빼먹으면 인덱스를 만들어 놓고도 안 쓰는 계획이 나온다.
ANALYZE users;
ANALYZE brag_post;
ANALYZE character_profiles;
ANALYZE attendance_logs;
ANALYZE program_applications;

\echo ''
\echo '=== 행 수 확인 ==='
SELECT 'brag_post' AS table_name, count(*) FROM brag_post
UNION ALL SELECT 'character_profiles', count(*) FROM character_profiles
UNION ALL SELECT 'attendance_logs', count(*) FROM attendance_logs
UNION ALL SELECT 'program_applications', count(*) FROM program_applications;
