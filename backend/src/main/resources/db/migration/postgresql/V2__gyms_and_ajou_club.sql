-- 0단계 PR 3: 운동 모임 → 짐(Gym). 설계 docs/design/stage0-gyms.md §1 · §4
-- Hibernate 가 새 칸(type · slug · visibility · status · parent_id · school_domain … · title, gym_features 테이블)을 먼저 만든 뒤 실행된다.
-- 여러 번 돌아도 결과가 같게 쓴다.

-- 1) 역할 값 LEADER → OWNER. Hibernate 가 만든 "LEADER/MEMBER 만 허용" 검사 제약을 먼저 지운다.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'workout_crew_members'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE workout_crew_members DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
UPDATE workout_crew_members SET role = 'OWNER' WHERE role = 'LEADER';

-- 2) 기존 운동 모임 = CREW 짐
UPDATE workout_crews SET type = 'CREW' WHERE type IS NULL;
UPDATE workout_crews SET status = 'ACTIVE' WHERE status IS NULL;
UPDATE workout_crews SET visibility = 'PUBLIC' WHERE visibility IS NULL;
UPDATE workout_crews SET slug = 'crew-' || id WHERE slug IS NULL;
UPDATE workout_crews SET map_theme = 'GYM' WHERE map_theme IS NULL;

-- 3) 아주대 동아리 짐(주인: 가장 먼저 가입한 앱 운영자, 없으면 가장 먼저 가입한 사람). 사용자가 없으면 만들지 않는다.
INSERT INTO workout_crews (name, description, owner_id, invite_code, join_policy, type, slug, visibility, status, school_domain, map_theme, created_at, updated_at)
SELECT '득근득근 · 아주대 헬스 동아리', '아주대학교 헬스 동아리 득근득근', u.id, 'AJOU-MUSCLEUP', 'LEADER_APPROVE',
       'CLUB', 'ajou-muscleup', 'PUBLIC', 'ACTIVE', 'ajou.ac.kr', 'GYM', now(), now()
FROM (SELECT COALESCE(
        (SELECT MIN(id) FROM users WHERE role IN ('ROLE_ADMIN', 'ADMIN')),
        (SELECT MIN(id) FROM users)) AS id) u
WHERE u.id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM workout_crews WHERE slug = 'ajou-muscleup');

-- 4) 기존 운동 모임은 아주대 동아리의 소모임
UPDATE workout_crews SET parent_id = (SELECT id FROM workout_crews WHERE slug = 'ajou-muscleup')
WHERE type = 'CREW' AND parent_id IS NULL AND EXISTS (SELECT 1 FROM workout_crews WHERE slug = 'ajou-muscleup');

-- 5) 지금 가입자 전원 = 아주대 짐 멤버(주인은 OWNER)
INSERT INTO workout_crew_members (crew_id, user_id, role, created_at, updated_at)
SELECT g.id, u.id, CASE WHEN u.id = g.owner_id THEN 'OWNER' ELSE 'MEMBER' END, now(), now()
FROM users u CROSS JOIN workout_crews g
WHERE g.slug = 'ajou-muscleup'
  AND NOT EXISTS (SELECT 1 FROM workout_crew_members m WHERE m.crew_id = g.id AND m.user_id = u.id);

-- 6) 기능: 지금 있는 짐은 전부 켠다(앞으로 짐별로 끄고 켬)
INSERT INTO gym_features (gym_id, feature)
SELECT g.id, f.feature
FROM workout_crews g
CROSS JOIN (VALUES ('ATTENDANCE'), ('RANKING'), ('BOARD'), ('EVENTS'), ('GROUP_BUY'), ('LOUNGE'), ('STAFF_PAGE')) AS f(feature)
WHERE NOT EXISTS (SELECT 1 FROM gym_features x WHERE x.gym_id = g.id AND x.feature = f.feature);
