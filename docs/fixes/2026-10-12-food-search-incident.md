# 2026-10-12 · 장애: 음식 검색 데이터가 운영 DB 볼륨을 가득 채워 사이트가 멈춤 → 메모리 검색으로 바꿈

## 1. 무슨 일이 있었나 (한국 시간)
| 시각 | 일 |
|---|---|
| 19:09 | PR #17(식단 기록) 머지 — #18(음식 검색)이 그 안에 포함. Railway · Vercel 배포 성공 |
| 19:12~ | 백엔드가 뜬 뒤 `FoodCatalogService` 가 `food_items` 에 32만 줄을 **한 트랜잭션**으로 넣기 시작(+ V5 trigram GIN 인덱스) |
| 19:15 | 운영 Postgres 볼륨(**500MB**)이 WAL · 표 · 인덱스로 가득 참 → `No space left on device`, Postgres 종료 · 복구 중 재시작 반복 |
| 19:16~ | DB 를 쓰는 모든 요청이 30초 기다린 뒤 500(`/api/events` · `/api/gyms` · 로그인 요청). `/ping` 은 정상 |
| 19:58 | 사용자가 `FOOD_CATALOG_AUTOLOAD=false` 추가(재배포 → 백엔드는 DB 없이 못 떠서 Crashed) |
| 20:3x | 사용자가 볼륨을 5GB 로 Live resize. Postgres 는 offline(재시작 포기 상태) |
| 20:46 | 사용자가 Postgres 이미지(`postgres-ssl:18`) 다시 배포 → 같은 볼륨으로 복구 완료 |
| 20:47 | `/api/gyms` 200. 로그인 마이페이지(10월 11일 저장 스탯) · 캐릭터 · 식단 정상 확인 |

약 1시간 30분 동안 DB 기능이 멈췄다. **데이터 손실 없음** — 넣던 32만 줄은 커밋 전이라 복구 때 되돌려졌고, 기존 데이터는 그대로.

## 2. 원인
- 운영 DB 볼륨 한도(Hobby 기본 500MB)를 확인하지 않고, 바뀌지 않는 참고 자료 32만 줄을 운영 DB 에 넣게 설계했다.
- 한 트랜잭션으로 넣어 WAL 이 정리되지 못하고 쌓였다(로그: redo 0/7B29458 → 0/19FFFE98 ≈ 300MB). 여기에 표(≈100MB)와 trigram 인덱스까지.
- 로컬 MySQL · 임시 Postgres 에는 용량 한도가 없어 테스트에서 드러나지 않았다.
- 확인 근거: 사용자가 준 Postgres 로그(`could not write to file "pg_wal/xlogtemp.59": No space left on device`), 볼륨 화면(96%).

## 3. 고친 것 (이 PR)
- `FoodCatalogService`: **DB 대신 서버 메모리.** 서버가 뜬 뒤 별도 스레드에서 `foods.tsv.gz` 를 읽어 목록으로 갖고 있고, 검색은 목록을 훑는다.
  - 로컬 측정: 읽기 2.5초, 힙 약 75MB(Item 18MB + 문자열), 검색 응답 44~59ms(인증 · HTTP 포함, "밥"처럼 수만 줄이 맞아도).
  - 처음 옮겼을 때 "밥" 검색이 847ms — 정렬 비교 중에 이름 정규화(정규식)를 반복해서. 줄마다 순위를 한 번만 계산해 `long` 하나로 묶어 정렬 → 59ms.
  - 메모리 절약: 숫자 float(없으면 NaN), 업체 이름 공유, 검색 키에서 정규화한 이름을 잘라 씀.
- 설정 이름을 `food.catalog.load-on-startup`(기본 true)으로 바꿨다 — 운영에 넣어 둔 `FOOD_CATALOG_AUTOLOAD=false` 는 더 이상 아무 일도 하지 않는다(지워도 됨).
- `V6__clear_food_items.sql`(postgresql · mysql): trigram 인덱스를 지우고 `TRUNCATE food_items`(되돌려진 줄이 남긴 공간 회수).
  - 표와 `FoodItem` 엔티티는 **빈 채로 남긴다**: 이미 배포한 V5 는 고칠 수 없고, 새로 만드는 DB 에서는 V5 가 이 표를 찾는다(표를 지우면 새 DB 에서 V5 가 실패해 서버가 안 뜬다 — 임시 PG 로 V0~V6 적용 확인).
- 테스트: `FoodSearchTest` 가 작은 파일을 메모리에 읽혀 검색을 확인(DB 다시 넣기 테스트는 의미가 없어 지움).

## 4. 확인
- 백엔드 42개 통과 — 로컬 MySQL + 새로 만든 임시 Postgres 17(V0~V6 적용, `food_items` 인덱스는 기본 키만).
- 로컬 MySQL: V6 적용, `food_items` 0줄.
- 로컬 실제 데이터 검색 결과 · 순서는 이전과 같음(하림 닭가슴살 · 계란 → 달걀 · 바나나 → 바나나, 생것 · 김치찌개 등).

## 5. 다시 일어나지 않게
- CLAUDE.md 함정에 추가: 운영 DB 볼륨 한도 · 큰 참고 데이터는 DB 에 넣지 않는다 · 대량 쓰기는 작은 트랜잭션으로.
- 운영 볼륨은 5GB 로 늘어났다(쓴 만큼 과금, 줄일 수 없음).

## 6. 남은 것 (사용자)
- 배포 뒤 Railway Postgres 볼륨 사용량이 줄었는지(V6 TRUNCATE) 확인. 원래 크기로 돌아오지 않으면 WAL 이 정리될 때까지 잠시 기다린다.
- `FOOD_CATALOG_AUTOLOAD` 변수는 지워도 된다.
- 백엔드 메모리 사용이 약 75MB 늘어난다(Railway 메모리 과금).
