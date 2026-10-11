-- 0단계 PR 6-2: 소식 · 출석 이벤트 · 프로그램 신청 · 자랑방을 짐(모임)별로. 설계 docs/design/stage0-gyms.md §2 · §4-4
-- Hibernate 가 cms_events · events · program_applications · brag_post 의 gym_id 칸을 먼저 만든 뒤 실행된다.
-- 여러 번 돌아도 결과가 같게 쓴다.

-- 1) 자랑방 공개 범위에 GYM(우리 모임만) 추가. Hibernate 가 만든 "PUBLIC/FRIENDS 만 허용" 검사 제약을 지운다.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'brag_post'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%visibility%'
  LOOP
    EXECUTE format('ALTER TABLE brag_post DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- 2) 지금까지의 소식 · 출석 이벤트 · 프로그램 신청은 모두 아주대 동아리 것이었다 → 아주대 짐.
--    자랑방 글은 짐 없이(광장) 그대로 둔다 — 지금처럼 모두에게 보인다.
UPDATE cms_events SET gym_id = (SELECT id FROM workout_crews WHERE slug = 'ajou-muscleup')
WHERE gym_id IS NULL AND EXISTS (SELECT 1 FROM workout_crews WHERE slug = 'ajou-muscleup');
UPDATE events SET gym_id = (SELECT id FROM workout_crews WHERE slug = 'ajou-muscleup')
WHERE gym_id IS NULL AND EXISTS (SELECT 1 FROM workout_crews WHERE slug = 'ajou-muscleup');
UPDATE program_applications SET gym_id = (SELECT id FROM workout_crews WHERE slug = 'ajou-muscleup')
WHERE gym_id IS NULL AND EXISTS (SELECT 1 FROM workout_crews WHERE slug = 'ajou-muscleup');
