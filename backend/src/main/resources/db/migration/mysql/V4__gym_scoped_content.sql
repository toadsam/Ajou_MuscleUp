-- 0단계 PR 6-2: 소식 · 출석 이벤트 · 프로그램 신청 · 자랑방을 짐(모임)별로. 설계 docs/design/stage0-gyms.md §2 · §4-4  (Postgres 판과 같은 내용)
-- Hibernate 가 gym_id 칸을 먼저 만든 뒤 실행된다. 여러 번 돌아도 결과가 같게 쓴다.

-- 1) 자랑방 공개 범위에 GYM(우리 모임만) 추가. Hibernate 가 MySQL 에 enum('PUBLIC','FRIENDS') 으로 만든 칸을 문자열로 바꾼다.
ALTER TABLE brag_post MODIFY visibility VARCHAR(16) NOT NULL;

-- 2) 지금까지의 소식 · 출석 이벤트 · 프로그램 신청은 모두 아주대 동아리 것이었다 → 아주대 짐. 자랑방 글은 광장 그대로.
--    MySQL 은 UPDATE 하는 테이블을 하위 쿼리에서 못 읽지만, 여기서는 다른 테이블(workout_crews)을 읽으므로 괜찮다.
UPDATE cms_events SET gym_id = (SELECT id FROM workout_crews WHERE slug = 'ajou-muscleup')
WHERE gym_id IS NULL AND EXISTS (SELECT 1 FROM workout_crews WHERE slug = 'ajou-muscleup');
UPDATE events SET gym_id = (SELECT id FROM workout_crews WHERE slug = 'ajou-muscleup')
WHERE gym_id IS NULL AND EXISTS (SELECT 1 FROM workout_crews WHERE slug = 'ajou-muscleup');
UPDATE program_applications SET gym_id = (SELECT id FROM workout_crews WHERE slug = 'ajou-muscleup')
WHERE gym_id IS NULL AND EXISTS (SELECT 1 FROM workout_crews WHERE slug = 'ajou-muscleup');
