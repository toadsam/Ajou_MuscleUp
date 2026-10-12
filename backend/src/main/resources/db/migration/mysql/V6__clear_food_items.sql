-- 음식 검색 데이터를 DB 에서 서버 메모리로 옮겼다(FoodCatalogService). 로컬 food_items 를 비운다(표는 남김 — postgresql/V6 설명).
TRUNCATE TABLE food_items;
