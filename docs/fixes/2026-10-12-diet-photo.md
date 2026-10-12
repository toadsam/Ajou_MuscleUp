# 2026-10-12 · 식단 기록 PR C — 사진으로 기록

음식 사진 → AI 가 음식과 양을 찾음 → **영양값은 음식 검색 DB(식약처 · 농진청)에서** → 확인 화면에서 고르고 고친 뒤 저장.
AI 는 양을 틀릴 수 있어(±20~30%) 저장 전에 반드시 확인 화면을 거친다. 사진은 저장하지 않는다.

## 1. 서버
- `FoodPhotoRecognizer`(인터페이스) · `OpenAiFoodPhotoRecognizer`: `openai.model.vision`(gpt-4.1-mini)에 사진을 보내 JSON 스키마(strict)로
  `is_food`, 음식마다 `name`(보이는 이름, 포장 브랜드 포함) · `search_name`(DB 검색용 일반 이름) · `grams` · kcal/단백질/탄수화물/지방 추정 · `confidence` 를 받는다(최대 8개, 45초 제한).
  - OpenAI 오류는 종류(`error.code`)만 로그에 남긴다. 크레딧 소진 · 열쇠 문제(401, quota/credit/billing)는 503 "사진 분석을 지금 쓸 수 없어요. 음식을 직접 적어 주세요.", 그 밖은 502 "잠시 뒤에 다시".
- `FoodPhotoService.analyze`: 6MB까지, **앞부분 바이트로 JPG · PNG · WEBP 만**(파일 이름 · Content-Type 무시, `UploadFileTypes`), 하루 `diet.photo.daily-limit`(기본 10)번(`RateLimiter`, 키 = 사용자 id + 날짜).
  - 음식마다 `search_name` 으로 `FoodCatalogService.search` → 후보 3개: AI 가 읽은 브랜드 제품 → 원재료 · 음식 → 그 밖의 제품. 못 찾으면 후보 없음(화면이 AI 추정값).
  - **저장하지 않는다.** 확인 화면이 기존 `POST /api/diet/entries` 에 `source: "PHOTO"` 로 저장(`EntryRequest.source`, PHOTO 말고는 MANUAL 로).
- `POST /api/diet/photo`(multipart `image`).

## 2. 화면 — `components/diet/PhotoMealDialog.tsx`
- 식단 화면 위 "사진으로 기록" → 창: 끼니(지금 시각으로 미리 고름: 10시 전 아침 · 15시 전 점심 · 21시 전 저녁 · 그 뒤 간식), "사진 찍기"(카메라) · "앨범에서 고르기".
- 고른 사진을 브라우저에서 긴 변 1280px JPEG 로 줄여 보낸다(전송량 · 분석 비용, 브라우저가 열 수 있으면 HEIC 도 JPEG 로). 열 수 없으면 안내.
- 확인 화면: 음식마다 체크 · 이름 · 영양값 고르기(DB 후보 3개 + "AI 추정값") · 양(g) → 칼로리 · 영양소 다시 계산, "DB 값 / AI 추정" 표시, 확신도 0.5 미만이면 "확인 필요". 출처 문구.
- "N개 기록하기" → 하나씩 저장(중간에 실패하면 몇 개 저장됐는지 알려 주고 목록을 새로 고침).
- 안내: 사진은 분석에만 쓰고 저장하지 않음(OpenAI 가 분석), 하루 10번, 양 확인.

## 3. 같이 바꾼 것
- `docs/legal/privacy-draft.md`: 받는 정보에 "식단 사진 분석(선택) — 저장하지 않음", OpenAI 에 맡기는 일에 "식단 사진 분석".

## 4. 확인
- 새 `FoodPhotoTest` 3개(가짜 인식기): DB 값 연결 · 브랜드 제품 먼저 · DB 에 없으면 AI 추정 / 사진이 아니면 400(인식기 안 부름) · 음식 아님 · 하루 한도 429 · 로그인 / PHOTO 로 저장, 다른 값은 MANUAL.
- 백엔드 45개 통과 — 로컬 MySQL + 새 임시 Postgres 17.
- 로컬 화면(시험용 계정, 375px · 넓은 화면):
  - 실제 OpenAI 호출 → 로컬 열쇠 계정이 **크레딧 소진**(`429 credit_balance_exhausted`)이라 실제 음식 인식은 못 봤다. 이 경우 창에 "사진 분석을 지금 쓸 수 없어요. 음식을 직접 적어 주세요."가 나오는 것을 확인.
  - 확인 화면은 서버 응답을 흉내 내 그리기 · 계산 · 저장 확인: 현미밥 210g → 252kcal(DB 100g 120kcal), 150g 으로 바꾸면 180kcal, 소스는 "AI 추정 · 확인 필요", 하나 빼고 "2개 기록하기" → 간식에 PHOTO 로 2개 저장, 375px 가로 넘침 없음.

## 5. 남은 것
- **실제 음식 사진으로 인식 품질 확인**(OpenAI 크레딧 충전 뒤). 운영 열쇠가 같은 계정이면 운영에서도 사진 분석 · 인바디 AI 상담이 안 된다.
- 사진 분석 횟수는 서버 메모리 기준(재시작하면 초기화, 서버 여러 대면 대수만큼).
- 분석에 실패해도 하루 횟수는 줄어든다(남용 방지 쪽을 택함).
