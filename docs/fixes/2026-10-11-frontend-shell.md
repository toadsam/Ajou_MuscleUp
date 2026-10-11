# 2026-10-11 프론트 뼈대 — 로그인 흐름 · 라우트 · 헤더 · 베타 안내 · 도움말 · 멤버/운영진 · 안 쓰는 파일

전체 점검 항목 7 · 8 · 9 · 10 · 13 · 14 · 15/30 · 31 · 32 · 33 · 40(일부)과 덤(PWA 업데이트 알림, 로그인 alert, 관리자 라우트 방어)을 고친 기록.
용어는 제품 담당 결정대로 **운동 모임**(줄여서 "모임") · **공동구매** · **응원**을 쓴다.

검증(공통)
- `npx tsc -p tsconfig.app.json --noEmit` → 오류 0. `npx tsc -p tsconfig.node.json --noEmit`(vite.config.ts) → 오류 0.
- `node scripts/lint-diff.mjs` → 이 영역 파일은 모두 같거나 줄었다(SupportWidget 2→0, Login 5→4, Header 1→1, Register 3→3, 나머지 0→0).
  늘어난 파일은 `src/utils/proteinMeta.ts`(0→2) 하나뿐인데, 다른 영역 에이전트가 고치는 중인 파일이다.
- 개발 서버(5173)에서 바뀐 모듈을 `curl` 로 받아 모두 200(Vite 변환 성공): App, main, Login, Header, SupportWidget, BetaNoticeModal, About, Executives, Members, NotFound, ProtectedRoute, supportChatStorage.
- 화면(데스크톱 + 375px) 확인은 메인 세션이 한다. 이 기록을 쓴 시점에는 **화면으로는 보지 않았다.**
- 모든 편집은 원래 줄바꿈(CRLF)과 BOM 을 유지했다(`file` 로 확인).

---

### 7. 이메일로 가입하면 로그인할 방법이 없음

- **문제**: 소개 화면의 "지금 합류하기 / 무료 가입"이 `/register`(이메일·비밀번호 가입)로 보냈는데, 로그인 화면은 Google 로그인만 있다. 이메일로 가입한 사람은 들어올 길이 없었다.
- **원인**: `pages/Register.tsx` 는 이메일 가입, `pages/Login.tsx:222` 는 `{/* 회원가입 문구 임시 비활성화 */}` 로 Google 전용. `About.tsx:34,181` 의 `<a href="/register">`.
- **고친 코드**
  - `frontend/src/App.tsx` — `/register` 라우트는 남겨 두고(예전 링크 보호) 로그인으로 보낸다. `Register` lazy import 는 뺐다.
    ```diff
    - const Register = lazy(() => import("./pages/Register"));
    - <Route path="/register" element={<Register />} />
    + {/* 가입은 Google 로그인으로 한 번에 된다. 예전 /register 링크는 로그인 화면으로 보내고 안내를 띄운다 */}
    + <Route path="/register" element={<Navigate to="/login?from=register" replace />} />
    ```
  - `frontend/src/pages/Login.tsx` — `Login`: `?from=register` 로 오면 짧은 안내, 아래쪽 비어 있던 자리에 상시 안내 한 줄.
    ```diff
    + {fromRegister && (
    +   <p className="dg-well ...">득근득근은 따로 회원가입하지 않아요. Google 계정으로 처음 로그인하면 그대로 가입돼요.</p>
    + )}
    - {/* 회원가입 문구 임시 비활성화 */}
    + <p ...>처음이라면 Google 로그인만 하면 가입까지 끝나요.</p>
    ```
  - `frontend/src/pages/About.tsx` — 가입 버튼을 `/login?next=%2Fattendance`(로그인 상태면 `/attendance`)로. (15/30 에서 통째로 다시 씀)
  - `frontend/src/pages/Register.tsx` — 파일은 지우지 않았다(삭제 승인 목록에 없음). 맨 위에 "라우트에 연결돼 있지 않다"는 주석을 달고 `alert` 3개를 `toast` 로 바꿨다.
    ```diff
    - alert("인증코드를 이메일로 보냈습니다. 10분 내에 입력하세요.");
    + toast("인증코드를 이메일로 보냈어요. 10분 안에 입력해 주세요.", "success");
    - alert("이메일 인증 완료!");
    + toast("이메일 인증을 마쳤어요.", "success");
    - alert("회원가입이 완료되었습니다!");
    + toast("가입을 마쳤어요. 로그인해 주세요.", "success");
    ```
- **확인**: 타입 검사 0 오류. `/register` 는 `Navigate` 라서 서버 요청 없이 `/login?from=register` 로 바뀐다(코드 확인).
- **남은 것**: 이미 이메일로 가입한 계정이 DB 에 있다면 그 사람은 여전히 비밀번호로 들어올 수 없다(백엔드에 이메일 로그인 API 가 남아 있는지, 같은 이메일의 Google 계정과 합쳐지는지는 백엔드 영역에서 확인 필요). `Register.tsx` 는 지금 아무도 import 하지 않으니, 이메일 가입을 다시 열 계획이 없으면 지워도 된다(사용자 승인 필요). 도움말 추천 질문 "회원가입은 어디서 해요?"의 답은 서버(`/api/support/chat`)가 만든다 — 답에 `/register` 링크가 나와도 로그인으로 넘어가지만, 답 문구는 백엔드 영역에서 바꾸는 게 좋다.

### 8. 로그인하면 항상 홈으로 가 버림

- **문제**: 출석·라운지 같은 로그인 필요 화면을 열면 로그인으로 넘어가고, 로그인을 마치면 무조건 `/` 로 가서 원래 화면을 다시 찾아가야 했다.
- **원인**: `components/ProtectedRoute.tsx:108` `<Navigate to="/login" replace />` 가 돌아갈 주소를 넘기지 않음. `pages/Login.tsx:70` `window.location.href = "/"`.
- **고친 코드**
  - `frontend/src/components/ProtectedRoute.tsx` — `ProtectedRoute`: 지금 주소(경로+쿼리+해시)를 `state.from` 으로 넘긴다.
    ```diff
    - return <Navigate to="/login" replace />;
    + const from = `${location.pathname}${location.search}${location.hash}`;
    + return <Navigate to="/login" replace state={{ from }} />;
    ```
  - `frontend/src/pages/Login.tsx` — `safeReturnPath`, `readStoredReturn`, `writeStoredReturn` 추가. 돌아갈 곳은 `state.from` → `?next=` → (구글 리디렉트로 돌아온 경우) sessionStorage 에 둔 값 → `/` 순서. 같은 사이트 경로만 허용(`//host`, `/\host`, 다른 origin, `/login`·`/register` 자신은 버림).
    ```diff
    + function safeReturnPath(raw: unknown): string | null {
    +   if (typeof raw !== "string") return null;
    +   const value = raw.trim();
    +   if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
    +   const url = new URL(value, window.location.origin);
    +   if (url.origin !== window.location.origin) return null;
    +   if (url.pathname === "/login" || url.pathname === "/register") return null;
    +   return `${url.pathname}${url.search}${url.hash}`;
    + }
    ...
    -     alert(`${data.nickname}님, 환영합니다!`);
    -     window.location.href = "/";
    +     const target = readStoredReturn() ?? returnTo;
    +     writeStoredReturn(null);
    +     window.location.replace(target);
    ```
    - Safari 안정 모드(구글 페이지로 갔다가 `/login#id_token=...` 로 돌아오는 흐름)에서는 React state 가 사라지므로 `login_return_to` 를 sessionStorage 에 둔다. 해시에 `id_token` 이 없는 채로 로그인 화면을 열면 예전 값을 지워서, 오래전에 그만둔 로그인의 목적지로 끌려가지 않게 했다.
    - 새로 불러오기(`location.replace`)는 그대로 둔다 — 헤더 등이 새 로그인 상태를 처음부터 읽게 하려는 기존 동작 유지. 들어가는 값은 같은 사이트 경로뿐.
    - 환영 `alert` 는 지웠다(바로 새로고침되어 의미가 없음).
- **확인**: 타입 검사 0 오류. 경로 검사 규칙은 코드로 확인(외부 주소·`//evil.com`·`/\evil.com` 는 `null`).
- **남은 것**: 실제 Google 로그인은 사용자가 직접 해야 해서 "로그인 → 원래 화면 복귀"를 화면으로 끝까지 보지는 못했다.

### 9. 카카오톡 등 앱 안 브라우저에서 Google 로그인이 막힘

- **문제**: 카카오톡 단톡방에서 링크를 열면 Google 이 로그인을 막는다(disallowed_useragent). 그런데 "외부 브라우저로 열기" 버튼은 Google 스크립트가 **불러오기에 실패했을 때만** 보여서, 버튼은 뜨는데 누르면 막히는 상황이 됐다.
- **원인**: `Login.tsx:61` 감지 정규식, `:194` `{googleLoadFailed && ...}` 안에만 `:201` 외부 브라우저 버튼이 있었다. 정규식도 `/wv|...|NAVER|.../i` 로 대소문자 무시라 범위가 넓었다.
- **고친 코드**
  - `frontend/src/pages/Login.tsx` — `IN_APP_UA`, `detectInApp()` 추가. 앱 안 브라우저면 Google 버튼 **위에** 안내 칸을 먼저 보여 준다.
    ```diff
    - const isBlockedUserAgent = /wv|WebView|FBAN|FBAV|Instagram|Line|KAKAOTALK|NAVER|DaumApps/i.test(navigator.userAgent);
    + const IN_APP_UA = /KAKAOTALK|Instagram|FBAN|FBAV|FB_IAB|\bLine\/|NAVER\(inapp|DaumApps|; wv\)/;
    + const { inApp, kakao, android, ios } = detectInApp();
    ```
    - 카카오톡(안드로이드·iOS): "기본 브라우저로 열기" → `kakaotalk://web/openExternal?url=<로그인 주소>`.
    - 그 밖의 안드로이드: "Chrome으로 열기" → 기존 `intent://...;package=com.android.chrome;end` 그대로.
    - iOS(카카오톡 외): 3단계 안내(··· 또는 공유 → "Safari로 열기" → 없으면 링크 복사), "로그인 링크 복사" 버튼(`navigator.clipboard`, 실패하면 토스트로 길게 눌러 복사 안내), 주소가 보이는 읽기 전용 입력칸.
    - 열리는 주소에는 돌아갈 곳을 `?next=` 로 붙인다(바깥 브라우저에서도 원래 화면으로 복귀).
    - 기존 `googleLoadFailed` 칸의 "외부 브라우저에서 로그인 열기" 버튼은 그대로 둠(조건만 `inApp`).
- **확인**: 타입 검사 0 오류. 정규식은 코드로 확인(`Linux` 는 `\bLine\/` 에 걸리지 않음, 일반 안드로이드 Chrome 은 `; wv)` 가 없어 걸리지 않음).
- **남은 것**: 실기기(카카오톡 안드로이드/iOS, 인스타그램 iOS)에서 직접 눌러 보지 못했다. 데스크톱 브라우저 개발자도구의 UA 바꾸기로 안내 칸 표시만 볼 수 있다. 에브리타임 등 UA 에 표식이 없는 iOS 앱 브라우저는 감지되지 않는다(안드로이드는 `; wv)` 로 대부분 잡힘).

### 10. 멤버 실명 명단이 로그인 없이 공개 · 같은 소개 문구 · 중복 이름

- **문제**: `/members` 에 실명 약 100명이 로그인 없이 보였고, 모든 카드가 같은 가짜 소개("아주머슬업에서 함께 운동하고 성장하는 멤버입니다.")·영어 직함("Ajou MuscleUp Member")·"Crew" 칩을 달았다. "김규민"이 두 번 있었다. 위쪽 "운영 프로그램 18+", "월간 챌린지 12" 도 근거 없는 숫자.
- **원인**: `App.tsx` 에서 `/members` 가 공개 라우트, `Members.tsx:25-136` 하드코딩, `:38-39` 중복.
- **고친 코드**
  - `frontend/src/App.tsx` — `/members` 를 `ProtectedRoute` 로 감싸고, `/executives` 는 공개로 옮겼다(사용자 결정).
    ```diff
    - <Route path="/members" element={<Members />} />
    + <Route path="/members" element={<ProtectedRoute><Members /></ProtectedRoute>} />
    + <Route path="/executives" element={<Executives />} />
    - <Route path="/executives" element={<ProtectedRoute><Executives /></ProtectedRoute>} />
    ```
  - `frontend/src/pages/Members.tsx` — `MEMBER_NAMES` 상수(학기마다 고치라는 주석) 하나만 남기고 `Member` 타입·가짜 소개·태그·칩·`highlights`·`StatValue` 를 지웠다. 화면은 번호 + 이름만 있는 작은 칸 격자(모바일 2열).
    ```diff
    -   "김규민",
        "김규민",
    - bio: "아주머슬업에서 함께 운동하고 성장하는 멤버입니다.",
    - { label: "운영 프로그램", value: "18+" },
    - { label: "월간 챌린지", value: "12" },
    + 득근득근에서 함께 운동하는 멤버 {MEMBER_NAMES.length}명이에요. 회원끼리만 볼 수 있어요.
    ```
- **확인**: 타입 검사 0 오류, `grep -c '"김규민"'` → 1.
- **남은 것**: 실제로 동명이인 두 명이었다면 다시 넣어야 한다(운영진 확인). 명단을 서버(회원 DB)에서 받도록 바꾸는 건 범위 밖.

### 13. 없는 주소에 빈 화면

- **문제**: 오타 주소로 들어오면 헤더·푸터만 있고 본문이 비었다.
- **원인**: `App.tsx` 의 `<Routes>` 에 `path="*"` 가 없음.
- **고친 코드**
  - `frontend/src/pages/NotFound.tsx`(새 파일) — `Forbidden` 과 같은 철판 카드. 노란 원판 그림, "404", "페이지를 찾을 수 없어요", 들어온 주소, "홈으로 가기 / 출석하러 가기 / 라운지" 버튼.
  - `frontend/src/App.tsx`
    ```diff
    + const NotFound = lazy(() => import("./pages/NotFound"));
    + <Route path="*" element={<NotFound />} />
    ```
- **확인**: 타입 검사, 개발 서버 모듈 변환 200.
- **남은 것**: 배포(Vercel)는 `vercel.json` 이 모든 경로를 `index.html` 로 돌려서 HTTP 상태는 200 이다(SPA 한계, 화면만 404).

### 14. 헤더에 핵심 기능(출석·라운지·랭킹)이 없음

- **문제**: 서비스의 중심인 출석 → 캐릭터 → 라운지로 가는 메뉴가 헤더에 없고, 대신 "자랑 글쓰기" 같은 행동 링크가 메뉴에 섞여 있었다.
- **원인**: `layouts/Header.tsx:145-190` `navGroups`.
- **고친 코드**
  - `frontend/src/layouts/Header.tsx` — `navGroups`: 맨 앞에 "오늘 운동"(출석 체크·라운지·랭킹) 묶음 추가, "자랑 글쓰기" 삭제, "미디어"+"이벤트" 를 "소식"(이벤트·갤러리·득근득근 소개)으로 합쳐 묶음 수는 6개 그대로. 데스크톱 드롭다운과 모바일 메뉴가 같은 `navGroups` 를 쓰므로 둘 다 같이 바뀐다.
    ```diff
    + {
    +   label: "오늘 운동",
    +   links: [
    +     { to: "/attendance", label: "출석 체크" },
    +     { to: "/lounge", label: "라운지" },
    +     { to: "/rankings", label: "랭킹" },
    +   ],
    + },
      { label: "커뮤니티", links: [
          { to: "/brag", label: "자랑방" },
    -     { to: "/brag/write", label: "자랑 글쓰기" },
    +     { to: "/crew", label: "운동 모임" },
    +     { to: "/friends", label: "친구/채팅" },
          { to: "/protein", label: "단백질 공동구매" }, ...
    - { label: "미디어", ... }, { label: "이벤트", ... }
    + { label: "소식", links: [이벤트, 갤러리, 득근득근 소개] }
    ```
- **확인**: 타입 검사 0 오류. 용어: "운동 모임", "단백질 공동구매" 사용.
- **남은 것**: 1024px 근처에서 6개 묶음 + 닉네임 + 로그아웃이 한 줄에 들어가는지 화면으로 확인 필요(메인 세션).

### 15/30. 소개 화면의 지어낸 숫자 · 가짜 실시간 피드 · 없는 기능 약속

- **문제**: "이번 주 커뮤니티 모먼트 438/126/312"는 고정 숫자, "실시간 피드"는 하드코딩 문구(관리자 삭제 기록까지 노출), "트레이너가 개입", "주간 리포트"는 없는 기능, 핵심 루프 설명이 없고 링크는 `<a href>` 라 전체 새로고침.
- **원인**: `About.tsx:48-51`, `:151-156`, `:85`, `:121`, `:34,37,181,184`.
- **고친 코드**
  - `frontend/src/pages/About.tsx` — 내용을 다시 썼다(파일 통째 교체, CRLF 유지).
    - 첫 화면: "출석하면 캐릭터가 자라고, 라운지에서 함께 운동해요." + 동아리 커뮤니티 설명. 버튼은 `<Link>`: 로그인 전 "Google로 시작하기"(`/login?next=%2Fattendance`), 로그인 후 "출석하러 가기", 보조로 "라운지 둘러보기".
    - 숫자 칸은 공개 지표 `GET /api/metrics/lobby`(백엔드 `SecurityConfig` 에서 `permitAll`)의 `todayAttendanceCount`·`loungeVisitCount`·`totalThreeLiftKg` 를 그대로 쓴다. 불러오기 전/실패 시 "-" 와 안내 한 줄.
    - 화이트보드 "득근득근 한 바퀴": 출석 체크 → 캐릭터 성장 → 라운지 3단계, 각 칸이 해당 화면 링크.
    - "같이 쓰면 더 좋은 기능": 운동 모임(`/crew`), 자랑방(`/brag`, "응원"), 공동구매(`/protein`), AI 플래너(`/ai`) — 지금 있는 기능만.
    - 마무리 칸: "Google 계정으로 로그인하면 따로 가입 절차 없이…", "운영진 소개" 링크(이제 공개).
    ```diff
    - { label: "완료 루틴", value: "438" }, { label: "자랑 업로드", value: "126" }, { label: "AI 상담", value: "312" },
    + const res = await fetch(`${API_BASE}/api/metrics/lobby`, { credentials: "omit" });
    + { label: "오늘 출석", value: metrics?.todayAttendanceCount, unit: "명" }, ...
    - "관리자 삭제 - 갤러리 중복 파일",
    - desc: "AI 상담으로 즉시 피드백, 필요하면 트레이너가 개입해 세밀 조정.",
    - { title: "회고", desc: "주간 리포트로 개선 포인트 확인" },
    - <a href="/register" ...>무료 가입</a>
    + <Link to={startTo} ...>{startLabel}</Link>
    ```
- **확인**: 타입 검사 0 오류, 린트 0→0, 개발 서버 변환 200.
- **남은 것**: 화면 확인(메인 세션). 지표 API 가 꺼져 있으면 "-" 로 보인다.

### 31. 운영진 화면의 회사식 지표 · 영어 칩

- **문제**: "운영 스프린트 24/yr", "핵심 프로젝트 11" 같은 근거 없는 회사식 숫자, "Vision/Operations/Brand/Tech/Community" 영어 칩, "Executive 01" 영어 라벨.
- **원인**: `Executives.tsx:25-61` 하드코딩, `:63-67` `leadershipStats`.
- **고친 코드**
  - `frontend/src/pages/Executives.tsx` — 데이터는 유지하되 파일 맨 위 `LEADS: readonly Lead[]` 로 두고 "학기마다 고쳐 주세요. 마지막 확인: 2026년 2학기" 주석. `leadershipStats`·`StatValue`·`useCountUp` 제거. 칩은 한국어(총괄·운영·브랜드·기술·커뮤니티), 번호 라벨은 숫자만.
    ```diff
    - const leadershipStats = [ { label: "리더십 팀", value: "05" }, { label: "운영 스프린트", value: "24/yr" }, { label: "핵심 프로젝트", value: "11" } ] as const;
    + 득근득근을 꾸려 가는 운영진 {LEADS.length}명이에요. 동아리 운영이나 서비스에 대해 궁금한 점이 있으면 편하게 물어봐 주세요.
    -     area: "Vision",
    +     area: "총괄",
    -       Executive {String(idx + 1).padStart(2, "0")}
    +       {String(idx + 1).padStart(2, "0")}
    ```
- **확인**: 타입 검사 0 오류. `/executives` 는 이제 로그인 없이 열린다(10번).
- **남은 것**: "마지막 확인: 2026년 2학기"는 운영진이 실제 명단과 맞는지 확인해야 한다. 각자의 한마디(quote)는 기존 문구 그대로.

### 32. 베타 안내 창이 매번 다시 뜸

- **문제**: "닫기"는 이번 화면에서만 닫혀서 들어올 때마다 다시 떴다. 공유 카드를 처음 여는 사람에게도 떠서 내용을 가렸다. Esc 로 안 닫히고 포커스가 창 밖으로 빠졌다.
- **원인**: `BetaNoticeModal.tsx` 의 닫기 = `setOpen(false)` 뿐, 경로 조건·키보드 처리 없음. `App.tsx` 에서 전역으로 그림.
- **고친 코드**
  - `frontend/src/components/BetaNoticeModal.tsx` — 다시 씀.
    ```diff
    + const NOTICE_VERSION = "2026-10-beta";           // 안내를 바꾸면 이 값도 바꾼다
    + const DISMISSED_VERSION_KEY = "beta_notice_dismissed_version";
    + const QUIET_PATHS = [/^\/attendance\/share\//, /^\/ai\/share\//, /^\/login(\/|$)/, /^\/dev\//];
    - <button onClick={() => setOpen(false)}>닫기</button>
    + const dismiss = () => { writeStorage(DISMISSED_VERSION_KEY, NOTICE_VERSION); close(); };
    ```
    - "닫기" → 이 버전은 다시 안 뜸. 버전 문자열이 바뀌면 다시 한 번 뜬다. "오늘 하루 보지 않기"는 기존대로 24시간.
    - 공유 화면·로그인·`/dev/*` 에서는 안 뜨고, 그 뒤 다른 화면으로 옮기면 그때 판단한다(`useLocation`).
    - 열릴 때 첫 버튼에 포커스, Tab/Shift+Tab 은 창 안에서만 돈다, Esc 는 "닫기"와 같게, 닫으면 열리기 전 포커스로 돌아간다. `role="dialog"` `aria-modal` `aria-labelledby` `aria-describedby`.
    - localStorage 읽기/쓰기는 try/catch(사파리 개인 정보 보호 모드 등).
- **확인**: 타입 검사 0 오류, 린트 0→0.
- **남은 것**: "닫기"가 영구(버전 단위)가 되면서 "오늘 하루 보지 않기"는 사실상 덜 강한 선택지가 됐다. 버튼을 하나로 줄일지는 제품 담당 결정.

### 33. 도움말(득근이) 위젯이 화면을 느리게 하고, 다른 계정의 대화가 보임

- **문제**: (1) DOM 이 바뀔 때마다 `body *` 모든 요소에 `getComputedStyle` 을 돌려서 라운지처럼 자주 바뀌는 화면에서 무거웠다. 스크롤마다도 돌았다. (2) 대화 기록이 계정 구분 없는 `support_msgs` 하나에 저장돼, 같은 기기에서 다른 사람이 로그인해도 이전 사람의 질문이 보였다. (3) 답 속 링크가 `<a href>` 라 전체 새로고침. (4) 실패하면 "(HTTP 500)" 같은 원문이 보였다.
- **원인**: `SupportWidget.tsx:69-116`, `:49-57`, `:354`, `:162,169,202,207`.
- **고친 코드**
  - `frontend/src/components/SupportWidget.tsx`
    - 하단 바 찾기: 후보를 `DOCK_SELECTOR = ".fixed, .mobile-fixed-actions, .mobile-save-bar, .programs-mobile-action-dock, [data-bottom-dock]"` 로 좁혔다(Tailwind `fixed` 요소 + 알려진 하단 바 클래스). 재는 건 `requestAnimationFrame` 으로 한 프레임에 한 번, `MutationObserver` 는 `#root` 의 요소 추가/삭제와 `class` 변화만 본다(`style` 제외), `scroll` 리스너 제거.
      ```diff
      - const fixedNodes = Array.from(document.querySelectorAll<HTMLElement>("body *")).filter(...)
      + const fixedNodes = Array.from(document.querySelectorAll<HTMLElement>(DOCK_SELECTOR)).filter(...)
      - window.addEventListener("scroll", updateFabOffset, { passive: true });
      - const observer = new MutationObserver(updateFabOffset);
      - observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style"] });
      + const observer = new MutationObserver(schedule);   // rAF 로 묶음
      + observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
      ```
    - 대화 기록: 계정별 키(`support_msgs:<email>`)에만 저장, 로그인 안 했으면 저장하지 않음, 최근 60개까지. `storage`(다른 탭 로그인/로그아웃)·`focus`·문의창 열 때 계정을 다시 보고, 바뀌었으면 그 계정 기록으로 갈아끼운다. 로그아웃 상태로 확인되면 모든 계정 기록을 지운다. 예전 공용 키 `support_msgs` 는 처음 뜰 때 버린다.
    - 오류: `httpError`/`friendlyError` 사용.
      ```diff
      - throw new Error(`HTTP ${res.status}`);
      + throw await httpError(res, "안내 응답을 받지 못했어요.");
      - appendSystemMessage(`회장님 메시지 전송에 실패했어요. (${err?.message ?? "오류"})`);
      + appendSystemMessage(friendlyError(err, "회장님께 메시지를 보내지 못했어요. 잠시 후 다시 시도해 주세요."));
      ```
    - 답 속 링크 `<a href>` → `<Link to>`. 추천 질문 "크루(모임) 만들려면…" → "운동 모임은 어디서 만들어요?".
  - `frontend/src/lib/supportChatStorage.ts`(새 파일) — `supportChatKey()`, `clearSupportChat()`, `dropLegacySupportChat()`.
  - `frontend/src/layouts/Header.tsx` — `handleLogout` 에서 `clearSupportChat()` 호출.
- **확인**: 타입 검사 0 오류, 린트 2→0(`any` 두 개 제거).
- **남은 것**: `CrewChallenge.tsx` 모바일 탭 바(`fixed inset-x-4 bottom-4`)는 `.fixed` 로 잡힌다. 앞으로 CSS 파일에서 `position: fixed` 로 만든 하단 바를 새로 넣으면 그 요소에 `data-bottom-dock` 을 달아야 버튼이 피해 간다(다른 영역 파일이라 이번엔 손대지 않음). 실제 라운지 화면에서 성능(프레임) 측정은 못 했다.

### 40(이 영역 몫). API 주소 기본값 누락 · 배포 빌드 환경변수 검사

- **문제**: 헤더 로그아웃이 `VITE_API_BASE` 가 없으면 `undefined/api/auth/logout` 으로 요청했다. 배포 빌드에 API·실시간 서버 주소가 빠져도 빌드는 성공하고 사이트가 조용히 망가진다.
- **원인**: `Header.tsx:132` `${import.meta.env.VITE_API_BASE}` 그대로 사용(같은 파일 56줄에 `API_BASE` 가 이미 있었음). `vite.config.ts` 에 검사 없음.
- **판단 근거(배포 방식 확인)**
  - `frontend/.env.production` 에 `VITE_API_BASE="https://api.musclehub.co.kr"`, `VITE_REALTIME_URL="https://api.musclehub.co.kr"` — API 는 **다른 주소**다.
  - `.gitignore` 가 `.env`, `.env.*` 를 막아서 `.env.production` 은 저장소에 없다(`git ls-files` 빈 결과) → Vercel 빌드는 대시보드 환경변수로만 값을 받는다.
  - `frontend/vercel.json` 은 모든 경로를 `/index.html` 로 돌리는 rewrite 하나뿐이다. `/api` 를 백엔드로 넘기는 rewrite 가 없으므로 `VITE_API_BASE` 가 비면 API 요청이 HTML 을 받는다. 실시간은 `?? "http://localhost:4001"` 로 떨어진다(`Home.tsx:61`, `Lounge.tsx:154`, `Friends.tsx:14`).
  - 그래서 "같은 주소라 비어 있어도 되는" 경우가 아니다 → **경고가 아니라 빌드 실패**로 했다. 다만 나중에 리버스 프록시로 바꿀 때를 위해 `SKIP_API_ENV_CHECK=1` 이면 경고만.
- **고친 코드**
  - `frontend/src/layouts/Header.tsx` — `handleLogout`
    ```diff
    - await fetch(`${import.meta.env.VITE_API_BASE}/api/auth/logout`, {
    + await fetch(`${API_BASE}/api/auth/logout`, {
    ```
  - `frontend/vite.config.ts` — `checkProductionEnv(mode, command)`: `command === 'build' && mode === 'production'` 일 때만 `loadEnv(mode, '.', '')`(파일 + 실행 환경) 에서 두 값을 확인. `defineConfig({...})` → `defineConfig(({ mode, command }) => { checkProductionEnv(...); return {...} })`. 개발 서버(`vite`)에는 영향 없음.
    ```diff
    + const REQUIRED_PROD_ENV = ['VITE_API_BASE', 'VITE_REALTIME_URL'] as const
    + if (command !== 'build' || mode !== 'production') return
    + const env = loadEnv(mode, '.', '')
    + const missing = REQUIRED_PROD_ENV.filter((key) => !(env[key] ?? '').trim())
    + ...
    + if (env.SKIP_API_ENV_CHECK === '1') { console.warn(message); return }
    + throw new Error(message)
    ```
- **확인**: `VITE_REALTIME_URL= npx vite build`(빈 값으로 덮어쓰기) → 설정 단계에서 "[득근득근] 배포 빌드에 필요한 환경변수가 없습니다: VITE_REALTIME_URL …" 으로 exit 1. `tsc -p tsconfig.node.json` 0 오류.
- **남은 것(배포 때 할 일)**: Vercel 대시보드 Production 환경변수에 `VITE_API_BASE`, `VITE_REALTIME_URL` 이 실제로 있는지 확인. 없으면 다음 배포가 이 검사에서 멈춘다(의도한 동작). 다른 영역 파일의 같은 문제: `pages/Gallery.tsx:67`, `pages/Programs.tsx:484` 도 `?? ""` 없이 쓴다.

### 덤. PWA "새 버전" 알림이 옛 네온 스타일

- **문제**: 새 버전 알림이 남색 반투명 바탕 + 하늘색 테두리 + 파랑→보라 그라데이션 버튼(v2 금지 항목).
- **원인**: `main.tsx` `showPwaUpdateToast` 인라인 스타일.
- **고친 코드**
  - `frontend/src/main.tsx` — `showPwaUpdateToast`: 철판(`--dg-steel`) 바탕, 3px 검은 테두리, `0 5px 0` 단단한 그림자, "지금 업데이트"는 빨강(`--dg-red`), "나중에"는 밝은 철판(`--dg-steel-hi`). 버튼 높이 40px, 최대 폭 480px 가운데, 아래 안전 영역 반영, `role="status"`.
    ```diff
    - toast.style.background = "rgba(11, 17, 35, 0.95)";
    - toast.style.border = "1px solid rgba(120, 221, 255, 0.45)";
    - update.style.background = "linear-gradient(90deg, #2ec5ff, #7f6bff)";
    + background: "var(--dg-steel, #26272b)", border: "3px solid var(--dg-ink, #0e0e10)", boxShadow: "0 5px 0 var(--dg-ink, #0e0e10)",
    + Object.assign(update.style, buttonBase, { background: "var(--dg-red, #d9302a)", color: "#ffffff" });
    ```
- **확인**: 타입 검사 0 오류. 서비스워커 업데이트는 배포 환경에서만 나서 화면으로는 못 봤다.

### 덤. 로그인 화면 alert · 개발자 문구

- **고친 코드**: `frontend/src/pages/Login.tsx`
  ```diff
  - throw new Error(error || "로그인에 실패했습니다.");          // 서버 원문을 그대로 보여 줌
  + throw await httpError(response, "로그인하지 못했어요.");
  - alert(err?.message || "Google 로그인에 실패했습니다.");
  + toast(friendlyError(err, "Google 로그인에 실패했어요. 다시 시도해 주세요."), "error");
  - alert("Google Client ID가 설정되지 않았습니다.");
  + toast("지금은 Google 로그인을 쓸 수 없어요. 잠시 뒤에 다시 시도해 주세요.", "error");
  - "Google Client ID가 설정되지 않았습니다."   // 화면 문구
  + "지금은 Google 로그인을 준비하고 있어요. 잠시 뒤에 다시 와 주세요."
  ```
- **남은 것**: `storeSession` 은 아직 `refreshToken: data.refreshToken` 을 `user` 에 쓴다. 토큰 저장 방식은 다른 영역(`lib/installFetchAuth.ts`·`lib/api.ts`)이 바꾸는 중이라 지시대로 손대지 않았다 — 그쪽이 `scrubStoredRefreshToken()` 으로 지우고 있으니, 합칠 때 이 줄도 빼는 게 맞다(`ProtectedRoute.tsx`·`Header.tsx` 의 `refreshToken: existing…` 복사 줄도 같이).

### 덤. 관리자 라우트가 깨진 저장값에 멈춤

- **고친 코드**: `frontend/src/components/AdminRoute.tsx` — `localStorage.user` 의 `JSON.parse` 를 try/catch 로 감싸 깨진 값이면 권한 없음(→ `/forbidden`)으로 본다. 전에는 예외로 화면이 멈췄다.

---

## 지운 파일 (사용자 승인 목록, 삭제 전 `grep` 으로 import 0건 확인)

| 파일 | 줄 수 | 무엇이었나 |
|---|---:|---|
| `frontend/src/pages/Crew.tsx` | 612 | 라우트에 없던 예전 크루 화면(목록·상세·초대코드·챌린지 생성). `CrewHub`/`CrewChallenge` 와 겹침 |
| `frontend/src/components/CharacterAvatar.tsx` | 398 | 티어·성별별 SVG 캐릭터를 그리던 옛 아바타 컴포넌트. 픽셀 아바타로 대체 |
| `frontend/src/components/avatar/Arms.tsx` | 104 | 옛 SVG 아바타의 팔(성장 수치로 굵기 조절) |
| `frontend/src/components/avatar/Head.tsx` | 186 | 옛 SVG 아바타의 머리(성별·MBTI·휴식/출석 위험 표정) |
| `frontend/src/components/avatar/Legs.tsx` | 85 | 옛 SVG 아바타의 다리 |
| `frontend/src/components/avatar/Torso.tsx` | 83 | 옛 SVG 아바타의 몸통·운동복 |
| `frontend/src/components/avatar/Effects.tsx` | 233 | 옛 SVG 아바타의 티어 오라·스킬 이펙트 |

확인 명령: `grep -rnE "(pages|components|avatar)/(Crew|CharacterAvatar|Arms|Head|Legs|Torso|Effects)['\"]|\./(Arms|Head|Legs|Torso|Effects)['\"]" src` → 결과 없음. 지운 뒤 `tsc` 0 오류. (`AvatarRenderer.tsx` 는 `pixelAvatar`·`seed`·`types`·`tierPreset` 만 씀)
git 에는 남아 있으므로 `git checkout -- <경로>` 로 되살릴 수 있다(커밋 전).

## 남은 것 (다른 영역 필요)

- `pages/Gallery.tsx:67`, `pages/Programs.tsx:484` — `VITE_API_BASE` 를 `?? ""` 없이 사용.
- `lib/installFetchAuth.ts` 쪽 토큰 정리와 `Login.tsx` `storeSession` 의 `refreshToken` 줄 정리를 합칠 때 맞추기.
- 도움말 답(`/api/support/chat`, 백엔드)에서 "회원가입" 안내가 `/register` 를 가리키면 "Google 로그인으로 가입" 문구로 바꾸기.
- CSS 로 만든 하단 고정 바를 새로 추가하는 화면은 `data-bottom-dock` 속성 달기(도움말 버튼이 피해 가도록).
- `frontend/.env`, `frontend/.env.production` 에 `OPENAI_API_KEY`(sk-proj-…) 가 평문으로 있다. 저장소에는 안 올라가지만(`.gitignore`) `VITE_` 접두어가 아니라 번들엔 안 들어간다. 그래도 프론트 폴더에 둘 이유가 없고, 이 키가 어디서든 공유된 적이 있으면 폐기·재발급을 권한다(사용자 판단).
- `docs/fix-log.md` 요약 항목 추가는 메인 세션 몫.
