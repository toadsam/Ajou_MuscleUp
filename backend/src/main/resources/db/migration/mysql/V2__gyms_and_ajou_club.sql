-- 0단계 PR 3: 운동 모임 → 짐(Gym). 설계 docs/design/stage0-gyms.md §1 · §4  (Postgres 판과 같은 내용)
-- Hibernate 가 새 칸을 먼저 만든 뒤 실행된다. 여러 번 돌아도 결과가 같게 쓴다.

-- 1) 역할 값 LEADER → OWNER. Hibernate 가 MySQL 에 enum('LEADER','MEMBER') 으로 만든 칸을 문자열로 바꾼다.
ALTER TABLE workout_crew_members MODIFY role VARCHAR(16) NOT NULL;
UPDATE workout_crew_members SET role = 'OWNER' WHERE role = 'LEADER';

-- 2) 기존 운동 모임 = CREW 짐
UPDATE workout_crews SET type = 'CREW' WHERE type IS NULL;
UPDATE workout_crews SET status = 'ACTIVE' WHERE status IS NULL;
UPDATE workout_crews SET visibility = 'PUBLIC' WHERE visibility IS NULL;
UPDATE workout_crews SET slug = CONCAT('crew-', id) WHERE slug IS NULL;
UPDATE workout_crews SET map_theme = 'GYM' WHERE map_theme IS NULL;

-- 3) 아주대 동아리 짐
INSERT INTO workout_crews (name, description, owner_id, invite_code, join_policy, type, slug, visibility, status, school_domain, map_theme, created_at, updated_at)
SELECT '득근득근 · 아주대 헬스 동아리', '아주대학교 헬스 동아리 득근득근', u.id, 'AJOU-MUSCLEUP', 'LEADER_APPROVE',
       'CLUB', 'ajou-muscleup', 'PUBLIC', 'ACTIVE', 'ajou.ac.kr', 'GYM', NOW(), NOW()
FROM (SELECT COALESCE(
        (SELECT MIN(id) FROM users WHERE role IN ('ROLE_ADMIN', 'ADMIN')),
        (SELECT MIN(id) FROM users)) AS id) u
WHERE u.id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM (SELECT slug FROM workout_crews) w WHERE w.slug = 'ajou-muscleup');

-- 4) 기존 운동 모임은 아주대 동아리의 소모임 (MySQL 은 같은 테이블을 바로 읽으며 고칠 수 없어 한 번 감싼다)
UPDATE workout_crews c
JOIN (SELECT id FROM workout_crews WHERE slug = 'ajou-muscleup') g
SET c.parent_id = g.id
WHERE c.type = 'CREW' AND c.parent_id IS NULL;

-- 5) 지금 가입자 전원 = 아주대 짐 멤버
INSERT INTO workout_crew_members (crew_id, user_id, role, created_at, updated_at)
SELECT g.id, u.id, CASE WHEN u.id = g.owner_id THEN 'OWNER' ELSE 'MEMBER' END, NOW(), NOW()
FROM users u CROSS JOIN workout_crews g
WHERE g.slug = 'ajou-muscleup'
  AND NOT EXISTS (SELECT 1 FROM (SELECT crew_id, user_id FROM workout_crew_members) m WHERE m.crew_id = g.id AND m.user_id = u.id);

-- 6) 기능: 지금 있는 짐은 전부 켠다
INSERT INTO gym_features (gym_id, feature)
SELECT g.id, f.feature
FROM workout_crews g
CROSS JOIN (SELECT 'ATTENDANCE' AS feature UNION ALL SELECT 'RANKING' UNION ALL SELECT 'BOARD' UNION ALL SELECT 'EVENTS'
            UNION ALL SELECT 'GROUP_BUY' UNION ALL SELECT 'LOUNGE' UNION ALL SELECT 'STAFF_PAGE') f
WHERE NOT EXISTS (SELECT 1 FROM (SELECT gym_id, feature FROM gym_features) x WHERE x.gym_id = g.id AND x.feature = f.feature);
