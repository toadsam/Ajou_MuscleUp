-- 목록 화면 4개를 받쳐 주는 인덱스.
--
-- 왜: 아래 쿼리들은 전부 Pageable(페이지네이션)인데 정렬·필터 컬럼에 인덱스가
--     없었다. 그러면 DB 가 한 페이지(10건)를 주려고 테이블 전체를 읽어 정렬하고
--     (filesort), 행이 쌓일수록 뒤 페이지로 갈수록 느려진다.
--
-- 엔티티에 @Index 로도 선언해 두었고 ddl-auto=update 라 앱을 다시 띄우면
-- Hibernate 가 알아서 만든다. 이 파일은 기존 마이그레이션들과 같은 자리에
-- 기록을 남기고, 손으로 적용할 때 쓰기 위한 것이다.
--
-- ⚠️ 이 폴더의 다른 마이그레이션은 MySQL 문법이지만(로컬 프로파일이 MySQL),
--    운영은 PostgreSQL 이다(application-prod.properties). 두 문법을 같이 적는다.

-- ── PostgreSQL (운영) ────────────────────────────────────────────────────────
-- 자랑방 목록: ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_brag_post_created
    ON brag_post (created_at);

-- 공개 캐릭터 랭킹: WHERE is_public = true ORDER BY level DESC, updated_at DESC
-- 필터 컬럼을 맨 앞에 둔다. 정렬 두 컬럼이 같은 방향이라 오름차순 인덱스를
-- 거꾸로 훑어 그대로 쓸 수 있다.
CREATE INDEX IF NOT EXISTS idx_character_public_rank
    ON character_profiles (is_public, level, updated_at);

-- 공유 인증 관리: WHERE shared = true ORDER BY report_count DESC, updated_at DESC
CREATE INDEX IF NOT EXISTS idx_attendance_shared_report
    ON attendance_logs (shared, report_count, updated_at);

-- 프로그램 신청 목록: ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_program_app_created
    ON program_applications (created_at);

-- ── MySQL (로컬) ─────────────────────────────────────────────────────────────
-- MySQL 은 CREATE INDEX 에 IF NOT EXISTS 가 없다. 이미 있으면 1061 에러가 나는데
-- 그건 무시하면 된다(= 이미 걸려 있다는 뜻).
--
-- CREATE INDEX idx_brag_post_created           ON brag_post (created_at);
-- CREATE INDEX idx_character_public_rank       ON character_profiles (is_public, level, updated_at);
-- CREATE INDEX idx_attendance_shared_report    ON attendance_logs (shared, report_count, updated_at);
-- CREATE INDEX idx_program_app_created         ON program_applications (created_at);
