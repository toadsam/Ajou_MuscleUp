# 세부 수정 기록 (docs/fixes)

`docs/fix-log.md` 는 "무엇이 불편했고 어떻게 해결했나"를 한눈에 보는 요약이고,
이 폴더는 **어떤 코드를 어떻게 바꿨는지**를 파일·함수 단위로 남기는 세부 기록이다.

- 2026-10-11 전체 점검(프론트 40건 · 백엔드/실시간 30건 · 화면 확인 7건)에서 나온 문제를 영역별로 고친 기록:
  - [2026-10-11-backend-security.md](2026-10-11-backend-security.md) — 로그인·권한·업로드·요청 제한·CORS·예외 처리
  - [2026-10-11-backend-data.md](2026-10-11-backend-data.md) — 출석 무결성·성능(N+1)·시간대·인덱스·공개 응답·경험치 API
  - [2026-10-11-realtime-lounge.md](2026-10-11-realtime-lounge.md) — 실시간 서버 인증·채팅 보호·트래픽 제한, 라운지·친구 화면
  - [2026-10-11-frontend-shell.md](2026-10-11-frontend-shell.md) — 로그인 흐름·라우트·헤더·베타 안내·도움말·멤버/운영진·안 쓰는 파일
  - [2026-10-11-frontend-pages.md](2026-10-11-frontend-pages.md) — 출석·AI·갤러리·이벤트·랭킹·관리자·크루·소개
  - [2026-10-11-frontend-community.md](2026-10-11-frontend-community.md) — 자랑방·단백질 공구·리뷰

- [2026-10-11-guest-map-trial.md](2026-10-11-guest-map-trial.md) — 로그인 없이 지도 체험(캐릭터 만들기 · 출석 체험 · 가입 뒤 이어받기), S 계열 MBTI 색 버그

- [2026-10-11-roster-privacy.md](2026-10-11-roster-privacy.md) — 0단계 PR 1: 회원 실명 명단을 서버로(관리자 편집), 모임 상세 노출 재확인
- [2026-10-11-flyway-data-migrations.md](2026-10-11-flyway-data-migrations.md) — 0단계 PR 2: Flyway 를 Hibernate 다음에 도는 데이터 이전 전용으로 도입

- [2026-10-11-gyms.md](2026-10-11-gyms.md) — 0단계 PR 3: 짐 구조 · 짐별 운영진(GymPermissionService) · /api/gyms · 아주대 이전(V2)

- [2026-10-11-group-buy-scope.md](2026-10-11-group-buy-scope.md) — 0단계 PR 4: 공동구매 우리 모임 / 전체 모집(GroupBuyAccess) · 짐 안 랭킹

- [2026-10-11-social-accounts.md](2026-10-11-social-accounts.md) — 0단계 PR 5: 계정 연결(social_accounts) · 카카오 로그인 준비

## 항목 양식

```markdown
### N. 한 줄 제목(사용자가 겪는 증상)

- **문제**: 사용자가 보거나 겪는 것.
- **원인**: 왜 그런지. `파일:줄` 근거.
- **고친 코드**
  - `경로/파일` — `함수/컴포넌트 이름`: 무엇을 어떻게 바꿨는지 한두 줄.
    ```diff
    - 바뀌기 전 핵심 줄
    + 바뀐 뒤 핵심 줄
    ```
- **확인**: 타입 검사/컴파일, 직접 호출, 화면 등 실제로 한 것.
- **남은 것**: 못 한 것, 배포 때 할 일(환경변수 등), 사용자가 직접 해야 하는 것.
```

## 공용 부품 (이번 점검에서 추가)

- `frontend/src/lib/toast.ts` — `toast(message, kind)`. `window.alert` 대신 쓴다.
- `frontend/src/lib/httpError.ts` — `httpError(res, fallback)` / `friendlyError(err, fallback)`.
  "HTTP 500", 서버 원문, 영어 오류를 화면에 그대로 내보내지 않고 한국어 문장으로 바꾼다.
