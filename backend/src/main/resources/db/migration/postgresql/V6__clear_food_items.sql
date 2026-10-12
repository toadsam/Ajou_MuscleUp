-- 음식 검색 데이터를 DB 에서 서버 메모리로 옮겼다(FoodCatalogService).
-- 2026-10-12 운영 첫 배포 때 food_items 에 32만 줄을 넣다가 볼륨(500MB)이 가득 차 DB 가 멈췄다
-- (docs/fixes/2026-10-12-food-search-incident.md). 넣다 만 줄(되돌려진 줄)과 V5 의 trigram 인덱스를 지워 공간을 돌려받는다.
-- 표 자체는 남긴다: 이미 배포한 V5 가 새로 만드는 DB 에서 이 표를 찾기 때문(엔티티 FoodItem 이 빈 표를 만든다).
-- TRUNCATE 는 파일을 새로 만들어 공간을 바로 돌려준다(DELETE 와 달리 VACUUM 이 필요 없다).
DROP INDEX IF EXISTS idx_food_items_search_trgm;
TRUNCATE TABLE food_items;
