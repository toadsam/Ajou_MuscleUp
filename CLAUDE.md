# CLAUDE.md — 득근득근(Ajou MuscleUp)

아주대 헬스 동아리 커뮤니티 서비스. 출석 → 캐릭터 성장 → 실시간 라운지가 핵심 루프.
이 문서는 Claude 와 함께 작업할 때의 **하네스**(작업 규칙 · 실행 방법 · 검증 절차 · 함정)다.

```text
frontend/  React 19 + Vite + Tailwind 3 (TypeScript)
backend/   Spring Boot 3.5 (Java 17) — 로컬 MySQL, 운영 Postgres(ddl-auto=update)
realtime/  Socket.IO 라운지 서버
docs/      fix-log.md(수정 요약) · fixes/(코드 단위 세부 기록) · screenshots · 설계 문서
scripts/   verify.sh(검증)
```

---

## 1. 작업 루프 (모든 수정에 적용)

1. **원인부터 증명한다.** 추측으로 고치지 않는다. 재현하거나 측정해서 근거를 잡는다
   (브라우저에서 측정, 콘솔 실험, 로그, 코드 위치). 근거는 기록에 그대로 쓴다.
2. **고친다.** 기능 · 라우트 · API · 데이터 구조는 요청이 없는 한 바꾸지 않는다.
3. **검증한다.** `bash scripts/verify.sh` (빠르게: `--quick`).
   - 타입 검사 0 오류
   - 린트는 "바꾸기 전보다 늘지 않았는가"로 본다(원래 있던 오류가 많음)
   - 빌드 통과
4. **화면으로 확인한다.** 바뀐 화면을 데스크톱 + 모바일(375px)에서 직접 띄워 본다.
5. **기록한다.** `docs/fix-log.md` 맨 위에 항목 추가: 불편 → 원인 → 고친 방법 → 확인한 방법 / 아직 못 한 것.
   - 여러 파일을 고치는 큰 작업은 `docs/fixes/` 에 코드 단위 세부 기록(diff 포함)을 따로 남기고 fix-log 에서 링크한다.
   - Stop 훅(`.claude/hooks/require-fix-log.sh`)이 코드가 기록보다 새것이면 작업 종료를 막는다.
6. **확인 못 한 건 숨기지 않는다.** 로그인 필요·실기기 필요 등으로 못 본 부분은 기록과 답변에 명시한다.

사용자 규칙: 답변은 한국어. 커밋 · push · 파일/브랜치 삭제 · reset 같은 되돌리기 어려운 작업은 먼저 묻는다.

---

## 2. 로컬 실행

미리보기 서버로 띄운다(`.claude/launch.json`): `frontend`(5173) · `backend`(8080) · `realtime`(4001).
세 개 모두 켜져 있어야 로그인 · 캐릭터 · 라운지가 동작한다. 데이터가 안 뜨면 먼저 서버 상태를 본다:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/ping
```

- **백엔드 프로필 함정**: 이 PC 에 `SPRING_PROFILES_ACTIVE=mysql` 환경변수가 있어 그냥 `bootRun` 하면
  DataSource 오류가 난다. 반드시 `local` 로 덮어써서 실행한다(launch.json 에 반영됨).
- **로그인**: Google 로그인은 사용자가 직접 한다(Claude 가 계정 정보를 입력하지 않는다).
- **로그인 없이 볼 수 있는 확인용 화면**
  - `/dev/avatars` — 픽셀 아바타 모든 변형(개발 서버에서만 열림)
  - `/attendance/share/<slug>` — 공개 출석 공유 카드. slug 는 로컬 DB 에서 읽기 전용으로 조회:
    `SELECT share_slug FROM attendance_logs WHERE shared=1 ORDER BY id DESC LIMIT 3;`

---

## 3. 디자인 시스템 "짐 플로어(v2)"

헬스장 소재(고무 매트 · 볼트 철판 · 화이트보드 · 메이플 플랫폼 · 국제 규격 원판 색)로 만든 게임형 UI.
시안: claude.ai 아티팩트 "득근득근 게임 UI 시안"의 v2 줄.

- **색**: `tailwind.config.js` 에서 색 계열 자체를 재정의했다. 새 코드는 의미 이름을 쓴다:
  `steel-*`(바탕·글자), `plate-red`(주요 행동·25kg), `plate-yellow`(강조·티어·보상), `plate-green`(성공),
  `plate-blue`(정보·라운지), `chalk`, `board-*`(화이트보드). 원판 색은 의미가 있을 때만.
- **서체**: `font-display`(Black Han Sans, 한글 제목) · `font-num`(Big Shoulders, 숫자·영문 라벨) ·
  본문 IBM Plex Sans KR · `font-pen`(Nanum Pen Script, 화이트보드 제목에만).
- **부품**(`src/index.css`): `.dg-steel` `.dg-well` `.dg-rubber` `.dg-whiteboard` `.dg-platform`
  `.dg-btn` + `.dg-btn-primary|-steel` `.dg-chip` · 인터랙션 `.dg-rise` `.dg-pop` `.dg-lift`
  `.dg-plate-in` `.dg-loading-plates` · 초크 가루는 `.dg-btn-primary`/`.dg-chalk-burst` 클릭 시 자동.
- **공용 컴포넌트**: `components/gym/Barbell.tsx`(+ `plates.ts`), `components/gym/CountUp.tsx`,
  `hooks/useInView.ts`(callback ref), `hooks/useCountUp.ts`.
- **금지**: 반투명 유리 카드 · 블러 · 네온 글로우 · 장식 그라데이션 · 이모지 UI 아이콘 ·
  한글에 넓은 자간 · 카드 안 카드(한 단계까지) · 개발자용 문구 노출(`/api/...`, `ROLE_*`).
- **움직임**: 짧게(≤600ms), 의미 있는 순간에. `prefers-reduced-motion` 은 전역에서 꺼진다.
- **아바타**: `components/avatar/pixelAvatar.ts` 가 24×32 픽셀 리프터를 그린다. 데이터→그림 규칙은
  파일 머리 주석과 fix-log 참고. 바꾸면 `/dev/avatars` 로 확인.

---

## 4. 알려진 함정

- **백엔드 테스트도 `local` 프로필로 돌린다**: `cmd //c "set SPRING_PROFILES_ACTIVE=local&& backend\gradlew.bat -p backend test"`.
  그냥 돌리면 이 PC 의 `mysql` 프로필 때문에 `contextLoads` 가 DataSource 오류로 실패한다.
- **소셜 로그인은 `SocialLoginService` 로만 사용자를 찾는다**(공급자 · 회원 번호 → 인증된 이메일 → 새 가입). 이메일 없는 가입은 `…@users.musclehub.invalid`(`emailPlaceholder`) — 메일을 보내지 말고 화면엔 `lib/displayEmail.ts` 로. 카카오는 `KAKAO_*`(서버) · `VITE_KAKAO_REST_KEY`(화면)가 있어야 켜진다.
- **로그인 유지(리프레시) 토큰은 httpOnly 쿠키로만** 오간다. 프론트에서 `refreshToken` 을 저장 · 전송하지 않는다.
- **실시간 서버는 입장권으로만 들어간다**: 백엔드 `POST /api/realtime/ticket` → 실시간 서버가 서명 확인.
  두 서버에 같은 `REALTIME_TICKET_SECRET`(32자 이상)이 필요하다. 로컬은 개발용 값으로 자동 동작.
  클라이언트가 보낸 닉네임 · 레벨 · 이메일은 믿지 않는다. 브로드캐스트에 이메일을 싣지 않는다.
  라운지 방(광장 `square` · 모임 `gym:{id}`)도 입장권의 `room` 으로만 정한다(백엔드가 멤버 확인). 방을 나누는 코드를 바꾸면
  `realtime/bench/room-isolation.mjs`(`npm run check:rooms`, 개발 모드 서버)로 섞이지 않는지 본다.
- **로컬 타입 검사가 통과해도 Vercel 에서 실패할 수 있었다**: 이 PC 상위 폴더(`C:/Users/jk636/node_modules/@types`)를 TypeScript 가 끌어왔다. 지금은 `@types/node` 를 프로젝트에 넣고 tsconfig `"types"` 를 고정했다. 새 전역 타입이 필요하면 tsconfig `types` 에 명시한다.
- **배포 빌드는 `VITE_API_BASE` · `VITE_REALTIME_URL` 이 없으면 멈춘다**(`vite.config.ts`). 급할 땐 `SKIP_API_ENV_CHECK=1`.
- **DB 데이터 이전은 `backend/src/main/resources/db/migration`**(Flyway, Hibernate 다음에 실행 — `config/DataMigrationRunner`). 새 칸은 엔티티로, 채우기 · 옮기기는 SQL 로. 배포한 SQL 파일은 고치지 않는다(규칙: 그 폴더 README).
- **enum 칸에 새 값을 넣을 땐 DB 제약부터**: Hibernate 가 Postgres 에는 `CHECK (role IN (...))`, MySQL 에는 `enum(...)` 타입으로 만들어 둔다. 새 값만 코드에 넣으면 저장할 때 실패한다 → 같은 PR 에 제약을 푸는 이전 SQL(예: `V2__gyms_and_ajou_club.sql` 1번)을 넣는다.
- **"짐(Gym)" = `WorkoutCrew`**: 동아리 · 운동 모임 · 헬스장 · PT 가 같은 테이블(`type`). 권한은 `GymPermissionService` 한 곳에서(역할 OWNER · STAFF · MEMBER). 운동 모임 화면(`/api/crew`)은 CREW 만, 짐 API 는 `/api/gyms`.
- **서비스 워커(PWA) 시험은 Chrome 에서**: 앱 안 미리보기 브라우저는 새로고침마다 Cache Storage 를 비워 결과가 거짓으로 좋게 나온다. 빌드본은 `frontend-built`(4173)로 띄우고 Chrome 에서 `localhost:4173` 으로 본다. 화면 HTML 은 NetworkFirst(`vite.config.ts`) — `navigateFallback` 을 되살리지 않는다.
- **"오늘"은 한국 시간(KST)**: 백엔드는 `TimeConfig` 의 `Clock` 을 쓴다. `LocalDate.now()` 를 새로 쓰지 않는다.
- **오류 문구와 알림**: `alert()` 대신 `lib/toast.ts`, 오류는 `lib/httpError.ts`(`httpError`/`friendlyError`)로 한국어 문장만 보여 준다.
- **이름**: 운동 모임 · 공동구매 · 응원 으로 통일(코드 식별자는 그대로 둬도 됨).

- **html2canvas 는 CSS `filter`, `backdrop-filter` 를 그리지 않는다.** 출석 카드 캡처는 사진에
  필터를 미리 입힌 이미지로 바꿔 끼운다(`bakeMediaFilter`). 새 효과를 넣을 땐 저장본에 나오는지 확인.
- **Web Share(`navigator.share`)는 사용자가 방금 누른 직후에만 열린다.** 버튼 핸들러에서 공유 전에
  `await` 를 하지 않는다. 필요한 파일은 미리 만들어 둔다. 페이지 로드 시 자동 공유는 항상 실패한다.
- **캡처되는 카드는 px 고정 크기를 쓰지 않는다.** `.share-preview` 는 컨테이너이고 안쪽은 `cqw` 단위.
  (미리보기 폭과 저장 폭 1080px 이 달라 px 이면 비율이 깨진다)
- **`AttendanceShareView.tsx` 의 `ShareData` 는 출석 공유 데이터 타입**이라 DOM 의 Web Share 타입과
  이름이 겹친다. Web Share 쪽은 별도 타입을 쓴다.
- **줄바꿈이 파일마다 다르다(CRLF/LF/섞임, 일부 BOM).** 편집할 때 원래 줄바꿈과 BOM 을 유지한다.
  통째로 다시 쓰는 스크립트는 diff 를 폭발시킨다.
- **이모지가 `??` 로 깨진 소스가 있다**(커밋 `2de4f34`). 그 문자열을 다른 로직이 쓰고 있을 수 있으니
  고칠 때 영향 범위를 먼저 본다.

---

## 5. 남은 일

`docs/fix-log.md` 의 "남은 문제" 표가 백로그다. 손대면 표에서 지우고 위에 항목을 추가한다.
