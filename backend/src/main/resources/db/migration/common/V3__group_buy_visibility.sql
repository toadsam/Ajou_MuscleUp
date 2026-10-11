-- 0단계 PR 4: 공동구매 모집 범위. 예전 공동구매는 아주대 동아리 안에서만 보이던 글이므로 아주대 짐의 "우리 모임만"(GYM)으로.
-- Hibernate 가 proteins.gym_id · visibility · region · max_participants 칸을 먼저 만든 뒤 실행된다. 두 DB 공통 문법.
UPDATE proteins
SET gym_id = (SELECT id FROM workout_crews WHERE slug = 'ajou-muscleup'),
    visibility = 'GYM'
WHERE visibility IS NULL
  AND EXISTS (SELECT 1 FROM workout_crews WHERE slug = 'ajou-muscleup');
