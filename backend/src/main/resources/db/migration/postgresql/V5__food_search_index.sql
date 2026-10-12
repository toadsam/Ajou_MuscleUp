-- 음식 검색(식단 기록 PR B): food_items.search_key LIKE '%검색어%' 를 trigram 인덱스로 빠르게.
-- 32만 줄 기준 인덱스 없이 약 150ms, 있으면 3글자 이상 검색이 1ms 안쪽(1~2글자는 인덱스를 못 써 그대로).
-- 확장을 만들 권한이 없으면 건너뛴다(검색은 인덱스 없이도 동작) — 서버가 뜨지 못하는 일이 없게.
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_trgm 을 만들지 못해 음식 검색 인덱스를 건너뜁니다: %', SQLERRM;
END
$$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
        CREATE INDEX IF NOT EXISTS idx_food_items_search_trgm ON food_items USING gin (search_key gin_trgm_ops);
    END IF;
END
$$;
