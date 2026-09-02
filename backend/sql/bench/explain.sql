-- 목록 인덱스 전/후 실측 (PostgreSQL).
--
-- 이 파일이 답하는 것 세 가지
--   1. 인덱스가 실제로 쓰이는가        → EXPLAIN 계획에 Index Scan 이 나오는가
--   2. 얼마나 빨라지는가              → EXPLAIN ANALYZE 의 실행 시간
--   3. 그 대가는 얼마인가             → pg_relation_size 로 인덱스가 먹는 디스크
--
-- 그리고 넷째, 더 중요한 것:
--   4. **사용자가 기다리는 시간은 얼마나 줄어드는가**
--      Spring Data 의 Page 는 목록과 함께 count 를 날린다. 인덱스는 정렬을
--      없애 주지만 count 는 못 고친다. 그래서 쿼리 시간과 「한 페이지 전체」를
--      따로 잰다 — 아래 마지막 절이 그것이다.
--
-- 쓰는 법
--   1) 인덱스 없는 상태로 재기
--      psql "$DATABASE_URL" -f backend/sql/bench/explain.sql > before.txt
--   2) 인덱스 만들기
--      psql "$DATABASE_URL" -f backend/sql/migration_20260828_query_indexes.sql
--      psql "$DATABASE_URL" -c "ANALYZE brag_post; ANALYZE character_profiles; ANALYZE attendance_logs; ANALYZE program_applications;"
--   3) 다시 재기
--      psql "$DATABASE_URL" -f backend/sql/bench/explain.sql > after.txt
--
-- 주의: 한 번만 재고 결론 내지 말 것. 캐시가 데워지며 값이 흔들린다.
--       포트폴리오에 실린 값은 각 7회 중앙값이다.

\timing on

\echo ''
\echo '################ 1. 자랑방 목록 ################'
\echo '# BragPostRepository.findAllByOrderByCreatedAtDesc(Pageable)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM brag_post
ORDER BY created_at DESC
LIMIT 10 OFFSET 0;

\echo ''
\echo '################ 2. 공개 캐릭터 랭킹 ################'
\echo '# CharacterProfileRepository.findByIsPublicTrueOrderByLevelDescUpdatedAtDesc(Pageable)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM character_profiles
WHERE is_public = true
ORDER BY level DESC, updated_at DESC
LIMIT 10 OFFSET 0;

\echo ''
\echo '################ 3. 공유 인증 관리 ################'
\echo '# AttendanceLogRepository.findBySharedTrueOrderByReportCountDescUpdatedAtDesc(Pageable)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM attendance_logs
WHERE shared = true
ORDER BY report_count DESC, updated_at DESC
LIMIT 10 OFFSET 0;

\echo ''
\echo '################ 4. 프로그램 신청 목록 ################'
\echo '# ProgramApplicationRepository.findAllByOrderByCreatedAtDesc(Pageable)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM program_applications
ORDER BY created_at DESC
LIMIT 10 OFFSET 0;

\echo ''
\echo '################ 5. 한 페이지 전체 = 목록 + count ################'
\echo '# 여기가 사용자가 실제로 기다리는 시간이다.'
\echo '# Page<T> 는 위의 목록 쿼리에 더해 아래 count 를 한 번 더 날린다.'
\echo '# 인덱스는 정렬을 없애 주지만 count 는 여전히 전체를 세야 한다 —'
\echo '# 그래서 쿼리가 몇백 배 빨라져도 페이지는 그만큼 안 빨라진다.'
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*) FROM brag_post;

\echo ''
\echo '################ 6. 인덱스가 먹는 디스크 ################'
\echo '# 인덱스는 공짜가 아니다. 읽기를 벌고 쓰기와 용량을 낸다.'
SELECT
    i.relname AS index_name,
    t.relname AS table_name,
    pg_size_pretty(pg_relation_size(i.oid)) AS index_size
FROM pg_class i
JOIN pg_index ix ON ix.indexrelid = i.oid
JOIN pg_class t ON t.oid = ix.indrelid
WHERE i.relname IN (
    'idx_brag_post_created',
    'idx_character_public_rank',
    'idx_attendance_shared_report',
    'idx_program_app_created'
)
ORDER BY pg_relation_size(i.oid) DESC;

\echo ''
\echo '# 네 인덱스 합계'
SELECT pg_size_pretty(sum(pg_relation_size(i.oid))) AS total_index_size
FROM pg_class i
WHERE i.relname IN (
    'idx_brag_post_created',
    'idx_character_public_rank',
    'idx_attendance_shared_report',
    'idx_program_app_created'
);

\echo ''
\echo '################ 7. 표 크기(비교용) ################'
SELECT relname AS table_name, pg_size_pretty(pg_total_relation_size(oid)) AS total_size
FROM pg_class
WHERE relname IN ('brag_post', 'character_profiles', 'attendance_logs', 'program_applications')
ORDER BY pg_total_relation_size(oid) DESC;

\timing off
