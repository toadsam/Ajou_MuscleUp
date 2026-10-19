# 2026-10-19 · 식단 바코드로 음식 넣기 — 세부 기록

fix-log 항목: [2026-10-19 · 식단 바코드](../fix-log.md)

## 흐름

```text
카메라(BarcodeDetector → 없으면 zxing) 또는 숫자 입력
  → GET /api/diet/barcode/{code}            (DietController)
  → BarcodeService.lookup                    숫자 8~14자리 · 하루 100번 · 서버 메모리 캐시(찾음 7일 / 없음 12시간, 2000개)
  → BarcodeProductSource.lookup              FoodSafetyBarcodeSource: 식품안전나라 C005 (이름 · 회사 · 유형, 영양값 없음)
  → 생산 중인 줄의 이름 → FoodCatalogService.search(이름 → 괄호 · 용량 뺀 이름 → 첫 낱말)
  → 순위: 이름이 같음 → 같은 회사 → 제품 → 검색 순서, 5개
  → 화면: 고르면 음식 추가 창의 pickFood(기존 검색과 같은 자리), 없으면 "이름만 채우기"(+ 내 음식 저장 켬)
```

## 실제 데이터로 확인 (로컬, 키는 application-local.properties)

| 바코드 | 바코드 정보의 이름 · 회사 | 첫 후보(음식 DB) |
|---|---|---|
| 8801043014809 | 신라면 · (주)농심 | 신라면 · 농심 · 100g당 417kcal |
| 8801043015653 | 육개장사발면 · (주)농심 | 육개장사발면 · 농심 |
| 8801094082604 | 코카콜라 제로 · 코카콜라음료(주) | 코카·콜라 제로 · 100ml당 0kcal |
| 8801056038861 | 핫식스 (같은 바코드의 다른 이름: 세븐업) | 핫식스 · 롯데칠성음료 |
| 8801062636358 | 화이트쿠키 빼빼로 · 롯데웰푸드(주) | 화이트쿠키 빼빼로 · 롯데웰푸드 |
| 8801115114154 | 서울우유1000 · 서울우유협동조합 안산공장 | 서울우유 1000mL · 100ml당 65kcal |
| 8801019606557 | 허니버터칩 · 해태가루비(주) | 허니버터칩 · 해태가루비 |
| 8801117752804 | 오!감자 감자그라탕맛 · (주)오리온제4청주공장 | 오감자감자그라탕맛 · 오리온 |
| 8801045570716 | 오뚜기열라면 · 오뚜기라면(주) | 오뚜기열라면 · 오뚜기라면 |
| 8809999999999 | (없음) | — |

- 같은 바코드에 여러 줄(4~5줄)이 흔하다: 공장 이전 · 생산 종료(END_DT) · 폐업(CLSBIZ_DT) 기록. 생산 중인 줄을 먼저 쓴다.
- 바코드를 다른 제품에 다시 쓴 경우가 있다(핫식스 · 세븐업) → `otherNames` 로 화면에 보여 준다.
- 처음 만든 회사 이름 정리는 "(주)오리온제4청주공장"을 빈 값으로 만들었다(괄호를 지운 뒤 남은 앞 공백 때문에 `\s+\S+공장$` 이 전체와 맞음) → 공백을 먼저 정리하고 "제N…공장"을 지우도록 고침, `BarcodeTest.makerNamesDropCompanyTypeAndFactory`.

## API 메모 (식품안전나라 Open API)

- 주소: `https://openapi.foodsafetykorea.go.kr/api/{키}/C005/json/1/20/BAR_CD={바코드}` — **키가 주소 경로에 들어간다** → 서버에서만 부르고 주소 · 예외 메시지를 로그에 남기지 않는다(`FoodSafetyBarcodeSource`, 상태 · 결과 코드만).
- 응답 UTF-8 JSON. `RESULT.CODE` INFO-000 성공 · INFO-200 데이터 없음 · 그 밖(키 · 권한 오류)은 502 로 바꿔 "잠시 뒤에".
- 바코드는 정확히 같은 값만 찾는다("12" 는 0건).
- I2790(식품영양성분DB)은 신청하지 않아 ERROR-310 — 영양값은 이미 있는 음식 DB(K-FIND)를 쓰므로 필요 없다.

## 화면

- `components/diet/BarcodeScanPanel.tsx`(새 파일): 음식 추가 창 안에 펼치는 칸. 카메라 · 노란 맞춤 칸 · 숫자 입력 · 결과(추천 1개 강조 + 후보) · 못 찾음 · 다시 찍기.
  - 읽기: `BarcodeDetector`(ean_13 · ean_8 · upc_a · upc_e, 250ms 마다) → 없으면 `@zxing/browser` 를 `import()` 로 그때만(빌드에서 따로 떨어진 묶음).
  - 읽으면 진동 60ms · 카메라 끔 · 조회. 창을 닫거나 결과가 나오면 카메라 트랙을 멈춘다.
  - 카메라를 못 쓰면(권한 · 카메라 없음 · http) 안내 문구 + 숫자 입력만.
  - **이 칸은 음식 추가 창의 `<form>` 안에 있다 → 안쪽에 `<form>` 을 두지 않는다.** 처음엔 숫자 칸을 form 으로 감쌌더니 Enter 가 바깥 저장을 건드려 창이 닫혔다(React 경고 "form cannot be a descendant of form"). Enter 는 `onKeyDown` 으로 직접 받는다.
- `Diet.tsx`: "사진으로 기록" 카드 → "찍어서 기록"(사진으로 기록 + 바코드 찍기). 바코드 찍기는 지금 시각 끼니로 음식 추가 창을 바코드 칸이 열린 채로 연다. 음식 추가 창의 "음식 이름" 옆 "바코드로 찾기".
- `DialogFrame.tsx`: `data-autofocus` 가 있으면 그 요소로 처음 포커스(바코드 칸의 "닫기") — 숫자 칸에 포커스가 가면 휴대폰 키보드가 카메라를 가린다.
- 기록 출처(source)는 그대로 MANUAL. BARCODE 를 따로 두려면 enum 제약부터 풀어야 해서(CLAUDE.md 함정) 이번에는 하지 않았다.

## 캡처 (모바일 375px, 앱 미리보기 — 카메라는 막혀 있어 숫자 입력으로)

- `docs/screenshots/diet-barcode/1-diet-card.jpg` — 식단 화면 "찍어서 기록"
- `docs/screenshots/diet-barcode/2-scan-no-camera.jpg` — 카메라를 못 쓸 때 안내 + 숫자 입력
- `docs/screenshots/diet-barcode/3-result.jpg` — 신라면 결과(추천 + 후보 4개, 같은 바코드의 다른 이름)
- `docs/screenshots/diet-barcode/4-filled.jpg` — 추천을 고른 뒤: 농심 신라면 120g · 500kcal 로 채워짐

## 바뀐 파일

- 백엔드: `service/BarcodeProductSource.java` · `service/FoodSafetyBarcodeSource.java` · `service/BarcodeService.java`(새), `controller/DietController.java`(엔드포인트), `test/.../BarcodeTest.java`(새, 6개)
- 프론트: `components/diet/BarcodeScanPanel.tsx`(새), `pages/Diet.tsx`, `components/DialogFrame.tsx`, `lib/foodSearch.ts`(`BarcodeResult`), `package.json`(`@zxing/browser` · `@zxing/library`)
