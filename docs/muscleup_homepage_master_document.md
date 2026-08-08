# 득근득근 MuscleUp 홈페이지 마스터 문서

초보자도 코드와 구조를 끝까지 따라갈 수 있도록 풀어쓴 React + Spring Boot 상세 기술 문서

| 항목 | 내용 |
| --- | --- |
| 대상 | 득근득근 MuscleUp 홈페이지와 메인 로비 흐름 |
| 주요 코드 | `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/pages/Home.tsx`, `frontend/src/styles/homeLobby.css` |
| 백엔드 범위 | 출석, 캐릭터, 신체 통계, 이벤트, 로비 지표 API |
| 실시간 범위 | `realtime/src/server.ts`의 `/status`와 Socket.IO 라운지 이벤트 |
| 문서 성격 | 초보자용 마스터 독스 + 개발자용 코드 추적 가이드 |
| 작성 기준 | 현재 작업 폴더의 실제 소스 코드 |

문서 사용 방법: 처음 읽는 사람은 1장부터 8장까지로 전체 그림을 잡고, 개발자는 9장 이후의 `Home.tsx`, API, Controller/Service 연결 흐름을 따라가면 됩니다. 코드를 수정할 때는 마지막의 수정 체크리스트를 작업 전후로 확인하세요.

## 빠른 목차

- 1-8장: 프로젝트 구조, 기술 스택, 실행 단위, 앱 진입점, 라우팅
- 9-22장: `Home.tsx`의 상태, 데이터 로딩, 계산값, UI 블록
- 23-29장: CSS, 반응형 구조, API, 백엔드 Controller/Service, 실시간 라운지
- 30-36장: 인증, 저장소, 오류 해결, 수정 체크리스트, 코드 읽기 연습, 핵심 요약

## 1. 한 문장으로 이해하기

득근득근 MuscleUp 홈페이지는 사용자가 로그인 후 오늘의 출석, 캐릭터 성장 상태, 진행 중 이벤트, 라운지 접속자, 커뮤니티 이동 경로를 한 화면에서 확인하고 바로 다음 행동으로 넘어가게 만드는 게임형 피트니스 로비입니다.

쉽게 말하면 다음 구조입니다.

```text
사용자 브라우저
  -> React 앱 진입점(main.tsx)
  -> 라우터(App.tsx)
  -> 홈 화면(Home.tsx)
  -> REST API 또는 realtime /status 호출
  -> Spring Boot Controller / Socket.IO 서버
  -> Service / Repository / room state
  -> JSON 응답
  -> React state 갱신
  -> 홈 화면 재렌더링
```

홈 화면의 핵심은 "오늘 무엇을 해야 하는가"를 빠르게 보여주는 것입니다. 출석이 아직 없으면 출석 버튼을 강조하고, 출석이 끝나면 캐릭터 리액션과 상태값으로 완료감을 줍니다. 동시에 전체 로비 지표와 라운지 접속자 수를 보여주어 개인 활동이 커뮤니티 경험으로 이어진다는 인상을 만듭니다.

## 2. 초보자 용어 사전

| 용어 | 쉬운 뜻 | 이 프로젝트에서의 예 |
| --- | --- | --- |
| 프론트엔드 | 사용자가 브라우저에서 직접 보는 화면 | `frontend/src/pages/Home.tsx` |
| 백엔드 | 화면 뒤에서 데이터 저장, 검증, 계산을 처리하는 서버 | `backend/src/main/java/com/ajou/muscleup` |
| API | 프론트엔드가 백엔드에 일을 요청하는 주소 | `GET /api/attendance/summary` |
| 라우팅 | URL에 따라 어떤 화면을 보여줄지 정하는 것 | `/`은 `Home`, `/attendance`는 `Attendance` |
| 컴포넌트 | React 화면을 구성하는 함수 단위 | `Home`, `Header`, `AvatarRenderer` |
| state | 화면이 기억하는 현재 값 | `summary`, `character`, `activeEvents` |
| hook | React에서 상태와 생명주기를 쓰는 함수 | `useState`, `useEffect`, `useMemo` |
| DTO | API로 주고받는 데이터 모양 | `AttendanceSummaryResponse`, `LobbyMetricsResponse` |
| Entity | DB 테이블과 연결되는 Java 클래스 | `AttendanceLog`, `CharacterProfile`, `CmsEvent` |
| Repository | DB 조회와 저장을 담당하는 Spring Data JPA 계층 | `AttendanceLogRepository`, `UserBodyStatsRepository` |
| Service | 실제 규칙과 계산이 들어가는 백엔드 클래스 | `MetricsServiceImpl`, `StatsServiceImpl` |
| Socket.IO | 실시간 양방향 통신 라이브러리 | 라운지 이동, 채팅, 이모트 |
| PWA | 모바일 앱처럼 설치 가능한 웹앱 | `vite-plugin-pwa`, service worker 등록 |
| JWT | 로그인 상태를 증명하는 토큰 | `Authorization: Bearer ...` |
| localStorage | 브라우저에 값을 저장하는 저장소 | `user`, `attendanceCompletedAt` |

## 3. 프로젝트 전체 구조

현재 폴더는 크게 세 실행 단위로 나뉩니다.

```text
Ajou_MuscleUp
  backend
    src/main/java/com/ajou/muscleup
      config          Security, JWT, CORS, Scheduler, Storage 설정
      controller      REST API 엔드포인트
      dto             요청/응답 데이터 모양
      entity          JPA 도메인 모델
      repository      DB 접근 계층
      service         비즈니스 로직
    src/main/resources
    src/test

  frontend
    src
      main.tsx        React 앱 시작점, 인증 부트스트랩, PWA 등록
      App.tsx         전체 라우팅과 공통 레이아웃
      layouts         Header, Footer
      pages           라우트별 화면
      services        API 서비스 모듈
      styles          화면별 CSS
      components      공통 컴포넌트와 아바타 렌더러
      utils           분석 로그, 공유 카드, 아바타 상태 유틸
      types           프론트엔드 타입
    public            PWA 아이콘 등 정적 파일

  realtime
    src
      server.ts       Socket.IO 서버와 /status HTTP 엔드포인트
      rooms.ts        라운지 room state 관리
      types.ts        Socket payload 타입
```

처음 코드를 읽는다면 다음 순서가 가장 좋습니다.

1. `frontend/src/main.tsx`에서 React 앱이 어떻게 시작되는지 봅니다.
2. `frontend/src/App.tsx`에서 URL과 페이지 연결을 봅니다.
3. `frontend/src/pages/Home.tsx`에서 메인 로비가 어떤 데이터를 불러오는지 봅니다.
4. `frontend/src/styles/homeLobby.css`에서 화면이 어떤 레이아웃으로 배치되는지 봅니다.
5. `frontend/src/services/eventApi.ts`와 `frontend/src/lib/api.ts`에서 Axios API 호출 방식을 봅니다.
6. `backend/controller/*Controller.java`에서 API 주소가 어떤 서비스로 연결되는지 봅니다.
7. `backend/service/*.java`에서 실제 계산과 저장 규칙을 봅니다.
8. `realtime/src/server.ts`에서 라운지 상태와 실시간 이벤트를 봅니다.

## 4. 프론트엔드 기술 스택

`frontend/package.json` 기준으로 홈 화면과 직접 관련 있는 주요 기술은 다음과 같습니다.

| 기술 | 역할 |
| --- | --- |
| React 19 | 화면 컴포넌트 작성 |
| React DOM | React 컴포넌트를 브라우저 DOM에 붙임 |
| React Router DOM 7 | URL 라우팅과 보호 라우트 |
| TypeScript | 컴포넌트 props, API 응답, 이벤트 타입 정적 검사 |
| Vite | 개발 서버와 프로덕션 빌드 |
| Tailwind CSS | 공통 레이아웃과 일부 페이지 스타일링 |
| Axios | API 서비스 모듈의 HTTP 통신 |
| TanStack React Query | 전역 서버 상태 관리 기반 |
| Recharts | 통계 시각화 페이지에서 사용 |
| Socket.IO Client | 라운지와 친구 채팅 실시간 통신 |
| Vite PWA | service worker와 앱 설치 경험 |

홈페이지 자체는 CSS 파일을 직접 import합니다.

```tsx
import "../styles/homeLobby.css";
```

이 방식은 홈 화면의 분위기가 다른 페이지보다 강하기 때문입니다. Tailwind 유틸리티만으로는 애니메이션, 오비트 효과, 모바일 고정 액션, 이벤트 슬라이더까지 일관되게 관리하기 어렵기 때문에 전용 CSS를 둔 구조입니다.

## 5. 백엔드 기술 스택

홈페이지가 직접 또는 간접으로 사용하는 백엔드 기술은 다음과 같습니다.

| 기술 | 역할 |
| --- | --- |
| Java 17 | 백엔드 런타임 |
| Spring Boot 3.5 | REST API 서버 |
| Spring Security | `@AuthenticationPrincipal` 기반 사용자 식별 |
| Spring Data JPA | 출석, 캐릭터, 이벤트, 통계 DB 접근 |
| MySQL / PostgreSQL | 로컬 및 배포 DB |
| JWT | access/refresh token 인증 흐름 |
| Lombok | DTO와 서비스 클래스 보일러플레이트 감소 |
| Gradle | 빌드와 테스트 |

홈 화면에서 중요한 Controller는 다음 다섯 개입니다.

| Controller | 홈 화면에서 쓰이는 역할 |
| --- | --- |
| `AttendanceController` | 월간 출석 로그와 요약 조회 |
| `CharacterController` | 내 캐릭터 프로필 조회 |
| `StatsController` | MBTI와 신체 통계 조회 |
| `MetricsController` | 로비 전체 지표 조회 |
| `EventPublicController` | 진행 중 이벤트 배너 조회 |

## 6. 실시간 서버 기술 스택

라운지 미리보기는 REST 백엔드가 아니라 별도 Node.js 서버 상태를 참고합니다.

| 기술 | 역할 |
| --- | --- |
| Node.js | 실시간 서버 런타임 |
| TypeScript | Socket payload와 room state 타입 관리 |
| Socket.IO | 라운지 입장, 이동, 채팅, 이모트, 파티 요청 |
| HTTP server | `/status` 엔드포인트로 현재 접속자 수 반환 |
| tsx | 개발 중 TypeScript watch 실행 |

홈페이지는 Socket.IO 연결을 직접 열지 않습니다. 대신 `GET http://localhost:4001/status` 형태로 현재 라운지 접속자 수만 10초마다 조회합니다.

## 7. 앱 진입점: `main.tsx`

파일: `frontend/src/main.tsx`

이 파일은 React 앱의 시작점입니다. 브라우저가 `index.html`의 `<div id="root"></div>`를 열면, `main.tsx`가 그 위치에 React 트리를 붙입니다.

핵심 구조는 다음과 같습니다.

```tsx
installFetchAuth();
void bootstrapAuthSession();

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    showPwaUpdateToast(() => updateSW(true));
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
```

중요한 점은 React를 렌더링하기 전에 인증 보조 로직을 설치한다는 것입니다.

- `installFetchAuth()`는 전역 `fetch`에 access token 자동 첨부와 401 재시도 로직을 설치합니다.
- `bootstrapAuthSession()`은 앱 시작 시 refresh API를 호출해 세션을 복구합니다.
- Safari에서는 service worker가 캐시를 오래 잡는 문제가 있어, 별도 해제 로직을 실행합니다.
- PWA 업데이트가 준비되면 커스텀 토스트로 사용자에게 새 버전을 알립니다.

즉 `main.tsx`는 단순 렌더링 파일이 아니라 인증, PWA, 브라우저 호환성의 첫 관문입니다.

## 8. 공통 라우팅과 레이아웃: `App.tsx`

파일: `frontend/src/App.tsx`

`App.tsx`는 모든 페이지의 공통 껍데기입니다. `Header`, `Footer`, `SupportWidget`, `BetaNoticeModal`을 항상 두고, 가운데 `Routes`에서 URL별 페이지를 렌더링합니다.

```tsx
<Router>
  <div className="flex min-h-screen flex-col">
    <Header />
    <main className="flex-grow">
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          ...
        </Routes>
      </Suspense>
    </main>
    <Footer />
    <SupportWidget />
    <BetaNoticeModal />
  </div>
</Router>
```

홈 화면의 라우트는 가장 단순합니다.

```tsx
<Route path="/" element={<Home />} />
```

로그인이 필요한 페이지는 `ProtectedRoute`로 감쌉니다. 관리자 페이지는 `AdminRoute`로 한 번 더 보호합니다.

| 경로 | 페이지 | 보호 여부 |
| --- | --- | --- |
| `/` | `Home` | 공개 |
| `/login`, `/register` | 로그인/회원가입 | 공개 |
| `/attendance` | 출석 | 로그인 필요 |
| `/mypage` | 마이페이지 | 로그인 필요 |
| `/ai`, `/ai/inbody` | AI 운동/인바디 | 로그인 필요 |
| `/brag`, `/protein`, `/crew`, `/friends` | 커뮤니티 기능 | 로그인 필요 |
| `/events`, `/events/:id` | 공개 이벤트 | 공개 |
| `/admin`, `/admin/events` | 관리자 | 관리자 권한 필요 |

## 9. 헤더와 네비게이션

파일: `frontend/src/layouts/Header.tsx`

홈페이지는 상단에 고정된 `Header`를 사용합니다. 헤더는 스크롤 상태에 따라 투명 배경과 흰 배경을 전환하고, 로그인 상태에 따라 로그인 버튼 또는 로그아웃 버튼을 보여줍니다.

헤더가 하는 일은 크게 다섯 가지입니다.

- `localStorage.user`에서 현재 사용자 정보를 읽습니다.
- `/api/auth/me`로 실제 세션이 살아 있는지 확인합니다.
- 데스크톱에서는 드롭다운 네비게이션을 보여줍니다.
- 모바일에서는 햄버거 버튼으로 메뉴를 펼칩니다.
- 관리자라면 커뮤니티 그룹 안에 관리자 링크를 추가합니다.

네비게이션 그룹은 다음과 같습니다.

| 그룹 | 주요 링크 |
| --- | --- |
| 커뮤니티 | 자랑방, 단백질 공동구매, 리뷰, 반 추천/신청, 운동 모임, 친구/채팅 |
| 멤버 | 운영진 소개, 멤버 소개 |
| 미디어 | 갤러리, 소개 |
| 이벤트 | 이벤트 |
| AI | AI 플래너, 인바디 분석 |
| 내 정보 | 마이페이지 |

홈페이지는 이 헤더 아래에서 시작하므로 `homeLobby.css`의 `.home-lobby`는 상단 고정 헤더 높이를 고려해 `padding: 6.5rem 0 5rem`을 둡니다.

## 10. 홈 화면의 역할: `Home.tsx`

파일: `frontend/src/pages/Home.tsx`

`Home.tsx`는 메인 로비 전체를 담당합니다. 화면상으로는 하나의 페이지지만, 내부적으로는 여러 도메인의 데이터를 동시에 가져옵니다.

홈 화면이 관리하는 주요 영역은 다음과 같습니다.

| 영역 | 화면 요소 | 데이터 출처 |
| --- | --- | --- |
| 히어로 | 브랜드 메시지, CTA, 전체 지표 | `/api/metrics/lobby` |
| 이벤트 배너 | 진행 중 이벤트 슬라이더 | `/api/events?status=ACTIVE` |
| 오늘의 액션 | 출석, 라운지, 캐릭터, 크루 이동 | 출석 API, 로컬 계산 |
| 캐릭터 미리보기 | 아바타 렌더링, 레벨, 티어, stage | `/api/character/me`, `/api/mypage/stats` |
| 라운지 미리보기 | 현재 접속자 수, 라운지 CTA | realtime `/status` |
| 퀘스트 루프 | 출석 -> 성장 -> 라운지 안내 | 정적 설명 |
| 모바일 고정 액션 | 출석하기, 운동모임 | 정적 링크 |

홈 화면은 "데이터 대시보드"와 "랜딩 페이지" 사이에 있습니다. 처음 보는 사람에게 서비스 정체성을 보여주면서도, 로그인한 사용자가 바로 출석과 라운지로 이동할 수 있게 설계되어 있습니다.

## 11. Home.tsx의 타입 정의

`Home.tsx`는 API 응답을 화면에서 바로 쓰기 위해 로컬 타입을 정의합니다.

```tsx
type AttendanceLog = {
  date: string;
  didWorkout: boolean;
  memo?: string | null;
  workoutTypes?: string[] | null;
  workoutIntensity?: string | null;
};

type AttendanceSummary = {
  monthWorkoutCount: number;
  currentStreak: number;
  bestStreakInMonth?: number | null;
};

type CharacterProfile = {
  level: number;
  tier: CharacterTier;
  evolutionStage: number;
  title?: string;
  avatarSeed: string;
  stylePreset: string;
  gender?: "MALE" | "FEMALE" | null;
  isResting?: boolean;
  growthParams?: GrowthParams | null;
};
```

이 타입들은 백엔드 DTO와 1:1로 완전히 분리된 프론트엔드 타입입니다. 장점은 `Home.tsx`가 필요한 필드만 명확히 볼 수 있다는 점입니다. 단점은 백엔드 DTO 필드명이 바뀌면 프론트 타입도 함께 관리해야 한다는 점입니다.

## 12. 환경변수와 기본 주소

`Home.tsx`는 두 환경변수를 읽습니다.

```tsx
const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const REALTIME_URL = import.meta.env.VITE_REALTIME_URL ?? "http://localhost:4001";
```

| 변수 | 의미 | 없을 때 |
| --- | --- | --- |
| `VITE_API_BASE` | Spring Boot 백엔드 주소 | 빈 문자열. Vite proxy 또는 상대경로 사용 |
| `VITE_REALTIME_URL` | Node realtime 서버 주소 | `http://localhost:4001` |

개발 환경에서 자주 보는 조합은 다음과 같습니다.

```text
frontend  http://localhost:5173
backend   http://localhost:8080
realtime  http://localhost:4001
```

프론트가 `VITE_API_BASE`를 비워두면 `/api/...` 상대 경로로 요청합니다. 배포 환경에서는 백엔드 도메인을 명시하는 편이 안전합니다.

## 13. 빠른 액션 정의

홈페이지의 "오늘의 액션" 버튼은 `ACTIONS` 상수로 정의됩니다.

```tsx
const ACTIONS = [
  { id: "attendance", label: "출석 체크하기", desc: "오늘의 첫 퀘스트", to: "/attendance" },
  { id: "lounge", label: "라운지 입장하기", desc: "지금 함께 운동", to: "/lounge" },
  { id: "character", label: "내 캐릭터 보기", desc: "성장 결과 확인", to: "/mypage" },
  { id: "crew", label: "운동 모임 가기", desc: "팀 출석률 확인", to: "/crew" },
];
```

모바일에서는 네 개를 모두 보여주지 않고, 핵심 행동인 출석과 운동 모임만 노출합니다.

```tsx
const visibleActions = useMemo(() => {
  if (!isMobile) return ACTIONS;
  return ACTIONS.filter((action) => action.id === "attendance" || action.id === "crew");
}, [isMobile]);
```

이 설계는 모바일 첫 화면의 정보량을 줄이기 위한 선택입니다. 홈 화면의 핵심 목표가 "오늘 출석을 시작하게 만드는 것"이므로, 작은 화면에서는 출석 CTA의 우선순위를 높입니다.

## 14. 날짜 유틸리티

홈페이지는 출석 데이터가 월 단위, 일 단위, 주 단위로 모두 필요합니다. 그래서 작은 날짜 유틸리티를 직접 둡니다.

| 함수 | 결과 | 쓰임 |
| --- | --- | --- |
| `formatMonthKey(date)` | `YYYY-MM` | 월간 출석 API 요청 |
| `formatDateKey(date)` | `YYYY-MM-DD` | 오늘 출석 여부 확인 |
| `startOfWeek(date)` | 해당 주 월요일 00:00 | 이번 주 운동일 계산 |

`startOfWeek`는 월요일 시작 기준입니다.

```tsx
const day = (clone.getDay() + 6) % 7;
clone.setDate(clone.getDate() - day);
```

`getDay()`는 일요일을 0으로 반환합니다. 위 계산은 월요일을 0으로 바꾸어 현재 주의 시작일을 구합니다.

## 15. 안전한 API 호출: `safeFetchJson`

홈페이지에서 출석, 캐릭터, 통계 데이터를 불러올 때는 Axios가 아니라 직접 `fetch`를 사용합니다.

```tsx
async function safeFetchJson<T>(path: string): Promise<T | null> {
  const url = API_BASE ? `${API_BASE}${path}` : path;
  const request = () =>
    fetch(url, {
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
  ...
}
```

이 함수가 하는 일은 다음과 같습니다.

1. `API_BASE`가 있으면 절대 URL로 요청합니다.
2. 없으면 `/api/...` 상대 경로로 요청합니다.
3. 쿠키 기반 세션을 위해 `credentials: "include"`를 붙입니다.
4. 401 또는 403이 나오면 `/api/auth/refresh`를 한 번 호출합니다.
5. refresh가 성공하면 원래 요청을 다시 시도합니다.
6. 그래도 인증이 실패하면 `null`을 반환합니다.
7. 그 외 실패는 에러 메시지를 파싱해 예외로 던집니다.

홈 화면은 공개 페이지지만, 로그인 사용자의 개인 데이터를 부드럽게 연결해야 합니다. 그래서 인증 실패를 화면 전체 에러로 만들지 않고 `null`로 처리하는 설계가 들어가 있습니다.

## 16. 홈 로비 데이터 로딩

`loadLobbyData`는 로그인 사용자가 있을 때만 실행됩니다.

```tsx
const [logsRes, summaryRes, characterRes, statsRes] = await Promise.all([
  safeFetchJson<AttendanceLog[]>(`/api/attendance?month=${monthKey}`),
  safeFetchJson<AttendanceSummary>(`/api/attendance/summary?month=${monthKey}`),
  safeFetchJson<CharacterProfile>("/api/character/me"),
  safeFetchJson<StatsResponse>("/api/mypage/stats"),
]);
```

한 번에 네 가지 데이터를 병렬로 가져옵니다.

| 요청 | 목적 | 실패 처리 |
| --- | --- | --- |
| `GET /api/attendance?month=YYYY-MM` | 월간 출석 로그 | `logs` 유지 또는 빈 배열 |
| `GET /api/attendance/summary?month=YYYY-MM` | 연속 출석, 월 운동 횟수 | `summary` 유지 또는 null |
| `GET /api/character/me` | 캐릭터 레벨, 티어, 아바타 seed | `character` 유지 또는 null |
| `GET /api/mypage/stats` | MBTI와 신체 통계 | `mbti` null |

`Promise.all`을 쓰기 때문에 네 요청 중 하나가 일반 에러를 던지면 catch로 이동합니다. 인증 실패는 `safeFetchJson`에서 `null`로 처리되므로 홈 화면이 바로 깨지지는 않습니다.

## 17. 라운지 접속자 로딩

`loadLoungeStatus`는 realtime 서버의 `/status`를 호출합니다.

```tsx
const res = await fetch(`${REALTIME_URL}/status`, { credentials: "omit" });
const payload = await res.json();
const count = Number(payload?.activePlayers);
```

여기서는 로그인 쿠키를 보내지 않습니다. 홈 화면에 필요한 값은 전체 접속자 수뿐이므로 인증이 필요 없는 공개 상태값으로 취급합니다.

요청이 실패하면 다음처럼 처리합니다.

```tsx
setLoungeCount(null);
```

렌더링에서는 null일 때 `"--"`로 표시합니다.

## 18. 로비 전체 지표 로딩

`loadLobbyMetrics`는 `GET /api/metrics/lobby`를 호출합니다.

응답 타입은 다음과 같습니다.

```tsx
type LobbyMetrics = {
  loungeVisitCount: number;
  todayAttendanceCount: number;
  totalThreeLiftKg: number;
};
```

백엔드 DTO는 `LobbyMetricsResponse`입니다.

| 필드 | 의미 | 백엔드 계산 |
| --- | --- | --- |
| `loungeVisitCount` | 라운지 누적 입장 수 | `loungeVisitLogRepository.count()` |
| `todayAttendanceCount` | 오늘 출석 기록 수 | `attendanceLogRepository.countByDate(today)` |
| `totalThreeLiftKg` | 모든 사용자의 3대 합산 | `userBodyStatsRepository.sumThreeLiftTotal()` |

이 API는 개인 정보가 아니라 서비스 전체 지표이므로 `credentials: "omit"`으로 호출합니다.

## 19. 진행 중 이벤트 로딩

홈 화면의 이벤트 배너는 `eventApi.getPublicList`를 사용합니다.

```tsx
const res = await eventApi.getPublicList({ status: "ACTIVE", page: 0, size: 10 });
setActiveEvents(res.content ?? []);
setEventIndex(0);
```

`eventApi`는 `frontend/src/services/eventApi.ts`에 있습니다.

```tsx
getPublicList: (params) =>
  api.get<EventPageResponse<EventItem>>("/api/events", { params }).then((res) => res.data)
```

여기서는 Axios 인스턴스 `api`를 쓰므로 `frontend/src/lib/api.ts`의 request interceptor가 access token을 자동으로 붙일 수 있습니다. 다만 이벤트 공개 목록은 백엔드에서 공개 API이므로 토큰이 없어도 동작해야 합니다.

## 20. useEffect 생명주기

홈페이지는 여러 `useEffect`를 사용합니다. 각각의 역할이 분리되어 있습니다.

| effect | 실행 조건 | 역할 |
| --- | --- | --- |
| localStorage user 읽기 | 최초 1회 | `localStorage.user`를 파싱해 `user` state 설정 |
| 모바일 감지 | 최초 1회 + resize | `max-width: 768px` 여부로 모바일 UI 전환 |
| 로비 개인 데이터 | `user`가 있을 때 | 출석, 캐릭터, MBTI 로딩 |
| 라운지 상태 | 최초 1회 + 10초 간격 | realtime `/status` 조회 |
| 로비 지표 | 최초 1회 + 30초 간격 | `/api/metrics/lobby` 조회 |
| 이벤트 | 최초 1회 | 진행 중 이벤트 조회 |
| focus/visibilitychange | 탭 복귀 시 | 로비 개인 데이터와 지표 재조회 |
| analytics | 최초 1회 | `logEvent("home", "page_view")` 기록 |
| 이벤트 슬라이더 | 이벤트 2개 이상 | 4.5초마다 다음 이벤트 |
| 출석 완료 리액션 | 오늘 출석 완료 감지 | 캐릭터와 액션 버튼 애니메이션 |

이 구조의 장점은 각 데이터의 갱신 주기가 다르다는 점을 코드가 분명히 보여준다는 것입니다. 개인 데이터는 로그인과 포커스 복귀에 맞추고, 실시간성 있는 라운지 수는 10초마다, 느리게 변하는 전체 지표는 30초마다 가져옵니다.

## 21. 계산값: 오늘 상태와 이번 주 상태

월간 출석 로그는 배열로 오지만, 오늘 출석 여부를 빨리 찾기 위해 `Map`으로 바꿉니다.

```tsx
const logMap = useMemo(() => {
  const map = new Map<string, AttendanceLog>();
  logs.forEach((log) => map.set(log.date, log));
  return map;
}, [logs]);
```

오늘 상태는 다음처럼 계산합니다.

```tsx
const todayLog = useMemo(() => logMap.get(todayKey), [logMap, todayKey]);
const isAttendanceDone = Boolean(todayLog);
```

화면에 보이는 라벨은 세 가지입니다.

| 조건 | 라벨 |
| --- | --- |
| 오늘 운동 기록 있음 | 운동 기록 완료 |
| 오늘 휴식 기록 있음 | 휴식 기록 완료 |
| 오늘 기록 없음 | 아직 기록 없음 |

이번 주 운동일은 월요일부터 7일을 만든 뒤, `didWorkout`인 로그 수를 셉니다. 이 값은 "이번 주 3/7"처럼 액션 허브 하단에 표시됩니다.

## 22. 출석 완료 리액션

출석 페이지가 완료 시점을 `localStorage.attendanceCompletedAt`에 저장하면, 홈 화면은 그것을 확인해 리액션을 보여줍니다.

```tsx
const completedAt = localStorage.getItem("attendanceCompletedAt");
if (completedAt === todayKey && isAttendanceDone) {
  setShowReaction(true);
  localStorage.removeItem("attendanceCompletedAt");
  const timer = window.setTimeout(() => setShowReaction(false), 2400);
}
```

이 구조는 페이지 간 직접 state 전달 없이도 "출석 페이지에서 완료 -> 홈으로 복귀 -> 캐릭터 반응"을 연결합니다. 단, localStorage 키가 문자열 계약이므로 출석 페이지와 홈 페이지가 같은 키를 사용해야 합니다.

## 23. 히어로 영역

히어로는 홈 화면의 첫인상입니다.

```tsx
<header className="hero">
  <div className="hero-text">
    <div className="hero-badge">게임형 피트니스 로비</div>
    <h1>
      <span className="hero-line brand">득근득근</span>
      <span className="hero-line strong-copy">오늘의 땀으로 성장 폭발</span>
      <span className="hero-line highlight">서로를 키우는 커뮤니티</span>
    </h1>
    ...
  </div>
</header>
```

히어로의 CTA는 두 개입니다.

| CTA | 이동 |
| --- | --- |
| 오늘 출석 시작 | `/attendance` |
| 운동모임 가기 | `/crew` |

히어로 지표는 `heroStats` 배열로 만들어 반복 렌더링합니다.

```tsx
const heroStats = [
  { label: "라운지 누적 입장", value: formatNumber(metrics?.loungeVisitCount) },
  { label: "오늘 기록된 출석", value: formatNumber(metrics?.todayAttendanceCount) },
  { label: "모두의 3대 합", value: totalThreeLiftLabel },
];
```

모바일에서는 요약이 기본으로 접히며, 사용자가 "오늘 요약 펼치기"를 눌러 확인합니다.

## 24. 진행 중 이벤트 배너

이벤트 배너는 `activeEvents.length > 0`일 때만 표시됩니다.

```tsx
{activeEvents.length > 0 && (!isMobile || showMobileOverview) && (
  <section className="event-banner">
    ...
  </section>
)}
```

슬라이더의 핵심은 `eventIndex`를 transform 값에 반영하는 것입니다.

```tsx
style={{ transform: `translateX(-${eventIndex * 100}%)` }}
```

자동 넘김은 4.5초마다 실행되고, 사용자가 마우스를 올리면 멈춥니다.

| 상태 | 역할 |
| --- | --- |
| `activeEvents` | 배너에 보여줄 이벤트 목록 |
| `eventIndex` | 현재 보이는 이벤트 번호 |
| `isEventPaused` | hover 중 자동 전환 중지 |

이벤트 카드 클릭 시 `/events/{id}`로 이동합니다. 이벤트 상세 페이지에서는 조회수와 클릭수 증가 API를 별도로 호출할 수 있습니다.

## 25. 오늘의 액션 허브

액션 허브는 홈 화면에서 가장 기능적인 영역입니다.

```tsx
<div className={`action-hub ${showReaction ? "reacted" : ""}`}>
  <div className="action-header">
    <span className="eyebrow">오늘의 액션</span>
    <h2>지금 해야 할 일</h2>
    <div className={`attendance-status ${isAttendanceDone ? "done" : "pending"}`}>
      {todayLabel}
    </div>
  </div>
  ...
</div>
```

출석 버튼은 오늘 출석 여부에 따라 시각 상태가 바뀝니다.

| 조건 | class | 화면 효과 |
| --- | --- | --- |
| 출석 전 | `urgent` | 테두리 강조, 흔들림 애니메이션 |
| 출석 완료 | `complete` | 초록색 완료 상태 |
| 방금 완료 | `burst` | 리액션 링 애니메이션 |

하단의 액션 통계는 세 개입니다.

| 항목 | 계산 |
| --- | --- |
| 연속 출석 | `summary?.currentStreak ?? 0` |
| 오늘 상태 | `todayLog ? "완료" : "대기"` |
| 이번 주 | `${weekStats.workoutDays}/7` |

로그인하지 않은 사용자는 "로그인하면 로비 상태가 연동됩니다." 메시지를 봅니다. 즉 홈 화면은 공개 접근을 허용하지만 개인화된 데이터는 로그인 후 활성화됩니다.

## 26. 캐릭터 미리보기

캐릭터 미리보기는 별도 함수 `renderCharacterPreviewCard`로 분리되어 있습니다. 데스크톱에서는 그리드의 한 칸으로 보이고, 모바일에서는 히어로 안쪽에 배치됩니다.

```tsx
{isMobile && renderCharacterPreviewCard("hero-character-mobile")}
...
{!isMobile && renderCharacterPreviewCard()}
```

캐릭터가 있으면 `AvatarRenderer`를 렌더링합니다.

```tsx
<AvatarRenderer
  avatarSeed={character.avatarSeed}
  growthParams={character.growthParams}
  tier={character.tier}
  stage={character.evolutionStage}
  gender={character.gender}
  mbti={mbti}
  isResting={character.isResting ?? false}
  size={180}
/>
```

캐릭터 렌더링에는 다음 값이 중요합니다.

| 값 | 의미 |
| --- | --- |
| `avatarSeed` | 캐릭터 외형 seed |
| `growthParams` | 신체 통계 기반 성장 파라미터 |
| `tier` | BRONZE부터 CHALLENGER까지 티어 |
| `evolutionStage` | 진화 단계 |
| `gender` | MALE/FEMALE 렌더링 분기 |
| `mbti` | 색감과 움직임 톤에 반영 |
| `isResting` | 휴식 중 배너와 상태 효과 |

캐릭터가 없으면 로그인 안내 placeholder를 보여줍니다. 이는 공개 홈에서 API 인증 실패가 발생해도 화면 전체가 비어 보이지 않게 하는 fallback입니다.

## 27. 라운지 미리보기

라운지 미리보기는 실제 라운지 월드의 축약판입니다. 원형 dot 8개가 움직이며 "지금 함께 운동하는 공간"이라는 느낌을 줍니다.

```tsx
<div className="lounge-canvas">
  <div className="lounge-avatars">
    {Array.from({ length: 8 }).map((_, idx) => (
      <span key={`avatar-${idx}`} className={`lounge-dot dot-${idx + 1}`} />
    ))}
  </div>
  <div className="lounge-info">
    <strong>지금 라운지에 {loungeCountLabel}명이 운동 중</strong>
  </div>
</div>
```

접속자 수는 realtime 서버 `/status`에서 가져옵니다. 실패하면 `"--"`로 표시되므로 realtime 서버가 꺼져 있어도 홈 화면 전체는 동작합니다.

## 28. 퀘스트 루프와 모바일 고정 액션

퀘스트 루프는 서비스의 핵심 행동 흐름을 짧게 보여줍니다.

```text
출석 체크 -> 캐릭터 성장 -> 라운지 진입
```

이 영역은 모바일에서 기본으로 접혀 있습니다. 사용자가 "커뮤니티 펼치기"를 눌러야 보입니다. 대신 모바일 하단에는 항상 두 개의 빠른 액션이 고정됩니다.

| 모바일 고정 버튼 | 이동 |
| --- | --- |
| 출석하기 | `/attendance` |
| 운동모임 | `/crew` |

작은 화면에서 CTA를 하단에 고정한 이유는, 사용자가 홈을 스크롤하다가도 바로 오늘의 행동으로 이동할 수 있게 하기 위해서입니다.

## 29. CSS 구조: `homeLobby.css`

파일: `frontend/src/styles/homeLobby.css`

홈 화면은 CSS 변수를 기준으로 색과 분위기를 통제합니다.

```css
:root {
  --lobby-bg: #0b0f14;
  --lobby-card: rgba(255, 255, 255, 0.06);
  --lobby-border: rgba(255, 255, 255, 0.12);
  --lobby-ink: #f8fafc;
  --lobby-muted: #94a3b8;
  --lobby-accent: #ff3b8d;
  --lobby-accent-2: #7c3aed;
  --lobby-accent-3: #22d3ee;
}
```

주요 CSS 블록은 다음과 같습니다.

| CSS 영역 | 역할 |
| --- | --- |
| `.home-lobby` | 전체 배경, 상하 padding, overflow |
| `.home-lobby-bg` | 배경 radial-gradient와 drift 애니메이션 |
| `.hero`, `.hero-text` | 히어로 텍스트와 CTA 배치 |
| `.hero-stats` | 로비 지표 카드 grid |
| `.event-banner` | 이벤트 슬라이더 컨테이너 |
| `.action-preview`, `.action-hub` | 오늘의 액션 카드 |
| `.character-preview` | 캐릭터 미리보기 카드 |
| `.lounge-preview` | 라운지 미리보기 카드 |
| `.quest-strip` | 출석-성장-라운지 루프 설명 |
| `.mobile-fixed-actions` | 모바일 하단 고정 액션 |
| `@keyframes` | pulse, fadeUp, neonPulse, float, spinSlow, shake 등 |

현재 홈 화면은 다크 톤과 네온 포인트를 강하게 사용합니다. 이는 운동 기록을 게임 로비처럼 보이게 하려는 의도입니다.

## 30. 반응형 설계

홈 화면은 `max-width: 768px` 기준으로 모바일 레이아웃을 바꿉니다.

모바일에서 달라지는 점은 다음과 같습니다.

| 영역 | 데스크톱 | 모바일 |
| --- | --- | --- |
| 캐릭터 카드 | 그리드의 독립 카드 | 히어로 내부에 삽입 |
| 액션 버튼 | 4개 모두 표시 | 출석, 운동모임만 표시 |
| 히어로 지표 | 기본 노출 | 접힌 상태에서 토글로 노출 |
| 이벤트 배너 | 기본 노출 | 오늘 요약 펼치기 후 노출 |
| 라운지/퀘스트 | 기본 노출 | 커뮤니티 펼치기 후 노출 |
| 빠른 이동 | 없음 | 하단 고정 버튼 2개 |

모바일 토글 state는 다음 네 개와 연결됩니다.

```tsx
const [isMobile, setIsMobile] = useState(false);
const [showMobileOverview, setShowMobileOverview] = useState(false);
const [showMobileCommunity, setShowMobileCommunity] = useState(false);
```

이 구조는 모바일 화면을 과하게 길게 만들지 않으면서도, 사용자가 필요할 때 이벤트와 커뮤니티 정보를 펼쳐볼 수 있게 합니다.

## 31. 홈페이지 API 연결표

홈 화면에서 직접 사용하는 API는 다음과 같습니다.

| 프론트 호출 | HTTP | 백엔드/서버 | 목적 |
| --- | --- | --- | --- |
| `safeFetchJson("/api/attendance?month=YYYY-MM")` | GET | `AttendanceController` | 월간 출석 로그 |
| `safeFetchJson("/api/attendance/summary?month=YYYY-MM")` | GET | `AttendanceController` | 월간 출석 요약 |
| `safeFetchJson("/api/character/me")` | GET | `CharacterController` | 내 캐릭터 프로필 |
| `safeFetchJson("/api/mypage/stats")` | GET | `StatsController` | MBTI와 신체 통계 |
| `fetch("/api/metrics/lobby")` | GET | `MetricsController` | 홈 히어로 전체 지표 |
| `eventApi.getPublicList({ status: "ACTIVE" })` | GET | `EventPublicController` | 진행 중 이벤트 |
| `fetch("${REALTIME_URL}/status")` | GET | `realtime/src/server.ts` | 라운지 현재 접속자 수 |
| `logEvent("home", "page_view")` | POST | `AnalyticsController` | 홈 방문 분석 로그 |

데이터 흐름을 한 줄로 줄이면 다음과 같습니다.

```text
Home.tsx state
  -> fetch / eventApi
  -> Spring Controller 또는 realtime HTTP server
  -> Service / Repository / room state
  -> JSON
  -> setState
  -> UI 재렌더링
```

## 32. 출석 API 연결

파일: `backend/src/main/java/com/ajou/muscleup/controller/AttendanceController.java`

홈 화면은 출석 API 중 두 개를 사용합니다.

| 엔드포인트 | Controller 메서드 | 홈에서의 쓰임 |
| --- | --- | --- |
| `GET /api/attendance?month=YYYY-MM` | `getMonthlyLogs` | 오늘 출석 여부와 주간 운동일 계산 |
| `GET /api/attendance/summary?month=YYYY-MM` | `getSummary` | 연속 출석 표시 |

Controller는 `@AuthenticationPrincipal String email`을 받아 현재 사용자를 식별합니다.

```java
@GetMapping
public ResponseEntity<List<AttendanceLogResponse>> getMonthlyLogs(
        @AuthenticationPrincipal String email,
        @RequestParam String month
) {
    YearMonth parsed = parseMonthOrThrow(month);
    return ResponseEntity.ok(attendanceService.getMonthlyLogs(email, parsed));
}
```

월 파라미터는 반드시 `YYYY-MM` 형식이어야 합니다. 형식이 틀리면 `400 Bad Request`가 발생합니다.

## 33. 캐릭터와 신체 통계 API 연결

캐릭터 미리보기에는 두 API가 함께 필요합니다.

| 엔드포인트 | Controller | 역할 |
| --- | --- | --- |
| `GET /api/character/me` | `CharacterController` | 캐릭터 프로필, 티어, 레벨, avatarSeed, growthParams |
| `GET /api/mypage/stats` | `StatsController` | MBTI와 신체 통계 |

`CharacterController`의 홈 관련 메서드는 다음입니다.

```java
@GetMapping("/me")
public ResponseEntity<CharacterProfileResponse> getMe(@AuthenticationPrincipal String email) {
    return ResponseEntity.ok(characterService.getOrCreateProfile(email));
}
```

`StatsController`는 신체 통계가 없을 때도 빈 응답 객체를 반환합니다. 그래서 홈 화면은 `statsRes?.mbti ?? null`로 안전하게 처리합니다.

```java
@GetMapping
public ResponseEntity<UserBodyStatsResponse> get(@AuthenticationPrincipal String email) {
    return ResponseEntity.ok(statsService.getStats(email));
}
```

캐릭터 렌더링은 백엔드가 계산한 값을 프론트 SVG 조합 컴포넌트에 전달하는 구조입니다.

```text
UserBodyStats
  -> CharacterGrowthCalculator
  -> GrowthParamsResponse
  -> CharacterProfileResponse
  -> Home.tsx
  -> AvatarRenderer
```

## 34. 로비 지표 API 연결

파일: `backend/src/main/java/com/ajou/muscleup/controller/MetricsController.java`

홈 화면의 히어로 지표는 `GET /api/metrics/lobby`에서 옵니다.

```java
@GetMapping("/lobby")
public ResponseEntity<LobbyMetricsResponse> getLobbyMetrics() {
    return ResponseEntity.ok(metricsService.getLobbyMetrics());
}
```

실제 계산은 `MetricsServiceImpl`에 있습니다.

```java
LocalDate today = LocalDate.now(KST);
long loungeVisitCount = loungeVisitLogRepository.count();
long todayAttendanceCount = attendanceLogRepository.countByDate(today);
double totalThreeLiftKg = userBodyStatsRepository.sumThreeLiftTotal();
```

주의할 점은 날짜 기준이 `Asia/Seoul`이라는 것입니다. 서버 시간이 UTC여도 오늘 출석 수는 KST 기준으로 계산됩니다.

## 35. 이벤트 API 연결

파일: `backend/src/main/java/com/ajou/muscleup/controller/EventPublicController.java`

홈 화면은 진행 중 이벤트만 요청합니다.

```tsx
eventApi.getPublicList({ status: "ACTIVE", page: 0, size: 10 });
```

백엔드에서는 `status`, `q`, `page`, `size`를 받습니다.

```java
@GetMapping
public ResponseEntity<Page<EventListItemResponse>> list(
        @RequestParam(required = false) CmsEventStatus status,
        @RequestParam(required = false) String q,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size
) {
    int safeSize = Math.max(1, Math.min(50, size));
    Pageable pageable = PageRequest.of(Math.max(page, 0), safeSize);
    return ResponseEntity.ok(cmsEventService.getPublicList(status, q, pageable));
}
```

`size`는 최대 50으로 제한됩니다. 홈 화면은 10개만 요청하므로 안전 범위 안에 있습니다.

## 36. 실시간 라운지 연결

파일: `realtime/src/server.ts`

홈 화면은 Socket.IO를 직접 사용하지 않고 `/status`만 사용합니다.

```ts
if (req.url?.startsWith("/status")) {
  const payload = {
    room: roomName,
    activePlayers: listPlayers().length,
  };
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
  return;
}
```

실제 라운지 페이지에서는 다음 Socket 이벤트를 사용합니다.

| 이벤트 | 역할 |
| --- | --- |
| `lounge:join` | 라운지 입장 및 프로필 등록 |
| `lounge:players` | 현재 플레이어 목록 브로드캐스트 |
| `player:move` | 플레이어 위치 업데이트 |
| `chat:send` | 채팅 메시지 전송 |
| `chat:typing` | 타이핑 상태 전송 |
| `social:emote` | 이모트 전송 |
| `social:sticker` | 스티커 전송 |
| `party:follow-request` | 따라가기 요청 |
| `party:teleport-request` | 순간이동 요청 |
| `ping:check` | 지연 시간 확인 |

홈 화면에서는 이 복잡한 실시간 기능을 "지금 라운지에 몇 명이 운동 중"이라는 간단한 상태로 압축해 보여줍니다.

## 37. 인증 흐름과 토큰 재시도

홈페이지는 공개 페이지이지만, 개인화 데이터는 인증이 필요합니다. 인증 보조 로직은 두 군데에 있습니다.

| 파일 | 적용 대상 | 역할 |
| --- | --- | --- |
| `frontend/src/lib/installFetchAuth.ts` | 전역 `fetch` | access token 자동 첨부, 401 refresh 후 재시도 |
| `frontend/src/lib/api.ts` | Axios 인스턴스 | Axios 요청에 access token 첨부, 401 refresh 후 재시도 |

`Home.tsx`의 `safeFetchJson`도 자체 refresh 재시도 로직을 가지고 있습니다. 즉 홈 화면의 직접 `fetch` 요청은 다음 세 겹 중 하나 이상에서 인증 보조를 받습니다.

```text
Home.safeFetchJson
  + installFetchAuth의 전역 fetch wrapper
  + 백엔드 쿠키/Authorization 처리
```

이 구조는 Safari나 배포 환경에서 쿠키만으로 세션이 불안정할 때도 localStorage access token으로 보완하기 위한 설계입니다.

## 38. 브라우저 저장소 키

홈페이지와 직접 관련 있는 localStorage 키는 다음과 같습니다.

| key | 쓰는 곳 | 의미 |
| --- | --- | --- |
| `user` | `Home.tsx`, `Header.tsx`, `installFetchAuth.ts`, `api.ts` | 로그인 사용자, accessToken, refreshToken |
| `attendanceCompletedAt` | `Home.tsx` | 오늘 출석 완료 후 홈 리액션 트리거 |
| `safari_sw_detached_once` | `main.tsx` | Safari service worker 해제 후 재로드 중복 방지 |
| `dev_sw_detached_once_v2` | `main.tsx` | 개발 환경 service worker 해제 후 재로드 중복 방지 |

저장소 키는 문자열 계약입니다. 이름을 바꿀 때는 검색으로 모든 사용 지점을 함께 바꿔야 합니다.

## 39. 오류와 fallback 전략

홈페이지는 백엔드 또는 realtime 서버 일부가 꺼져 있어도 전체 화면이 무너지지 않게 작성되어 있습니다.

| 실패 상황 | 화면 처리 |
| --- | --- |
| 로그인 정보 없음 | 개인 출석/캐릭터 영역은 안내 메시지 표시 |
| 출석/캐릭터 API 401 또는 403 | `null` 반환 후 로그인 세션 확인 메시지 |
| 로비 지표 API 실패 | 히어로 지표를 `"--"`로 표시 |
| realtime `/status` 실패 | 라운지 접속자 수를 `"--"`로 표시 |
| 이벤트 API 실패 | 이벤트 배너를 숨김 |
| 분석 로그 실패 | 콘솔 경고만 출력하고 UX는 유지 |

`Home.tsx`의 catch 메시지는 인증 실패와 일반 실패를 구분합니다.

```tsx
if (message.includes("Forbidden") || message.includes("Unauthorized") || ...) {
  setError("로그인 세션을 다시 확인하는 중입니다. 잠시 후 다시 시도해 주세요.");
} else {
  setError("로비 정보를 불러오지 못했어요.");
}
```

## 40. 자주 만나는 오류

### 홈에서 개인 데이터가 보이지 않음

가능한 원인:

- 로그인하지 않았습니다.
- `localStorage.user`가 깨졌습니다.
- access token이 만료됐고 refresh도 실패했습니다.
- 백엔드의 `@AuthenticationPrincipal`이 email을 받지 못했습니다.

확인 순서:

1. 브라우저 DevTools Application 탭에서 `localStorage.user` 확인
2. Network 탭에서 `/api/auth/refresh` 응답 확인
3. `/api/attendance`, `/api/character/me`, `/api/mypage/stats` 응답 상태 확인
4. 백엔드 Security/JWT 필터 로그 확인

### 라운지 접속자 수가 `--`로 보임

가능한 원인:

- realtime 서버가 실행 중이 아닙니다.
- `VITE_REALTIME_URL`이 실제 서버 주소와 다릅니다.
- realtime 서버 CORS `ORIGIN`에 프론트 주소가 없습니다.

확인 명령:

```powershell
cd realtime
npm run dev
```

브라우저에서 `http://localhost:4001/status`를 열어 `activePlayers`가 보이는지 확인합니다.

### 이벤트 배너가 보이지 않음

가능한 원인:

- `ACTIVE` 상태 이벤트가 없습니다.
- 이벤트 thumbnail URL이 비어 있거나 접근할 수 없습니다.
- `/api/events?status=ACTIVE` 요청이 실패했습니다.

확인 순서:

1. 관리자 이벤트 CMS에서 이벤트 상태 확인
2. Network 탭에서 `/api/events` 응답 확인
3. `EventListItemResponse.thumbnailUrl` 값 확인

### 출석 완료 리액션이 안 나옴

가능한 원인:

- 출석 페이지가 `attendanceCompletedAt`을 오늘 날짜로 저장하지 않았습니다.
- 홈으로 돌아왔지만 `/api/attendance` 재조회 전에 키가 제거됐습니다.
- `todayKey`와 저장된 날짜 형식이 다릅니다.

확인할 값:

```text
localStorage.attendanceCompletedAt = YYYY-MM-DD
Home.tsx todayKey = YYYY-MM-DD
```

## 41. 홈페이지 수정 체크리스트

홈 화면을 수정할 때는 다음 순서로 확인하세요.

1. `Home.tsx`에서 state가 새 데이터에 맞게 충분한지 확인합니다.
2. API가 필요하면 `services` 또는 `safeFetchJson` 호출 위치를 정합니다.
3. 로그인 필요 데이터인지 공개 데이터인지 먼저 결정합니다.
4. 공개 데이터라면 인증 실패가 화면 전체를 막지 않게 처리합니다.
5. 로딩, 실패, 빈 데이터 상태를 각각 화면에 반영합니다.
6. 모바일에서 기본 노출할지 토글 뒤에 숨길지 결정합니다.
7. `homeLobby.css`에서 데스크톱과 모바일 레이아웃을 모두 수정합니다.
8. 버튼이 보호 라우트로 이동하면 로그인 전 UX를 확인합니다.
9. 숫자 지표는 `formatNumber`처럼 안전한 formatter를 사용합니다.
10. 새 localStorage 키를 추가하면 키 이름과 제거 시점을 문서화합니다.
11. `npm run build`로 타입과 번들 오류를 확인합니다.
12. 실제 브라우저에서 `/`, `/attendance`, `/lounge`, `/events` 이동을 확인합니다.

## 42. API 추가 체크리스트

홈페이지에 새 백엔드 데이터를 붙일 때는 다음 순서가 안전합니다.

1. DTO를 먼저 정의합니다.
2. Repository에서 필요한 조회 메서드를 만듭니다.
3. Service에서 조회/계산 규칙을 구현합니다.
4. Controller에 `GET /api/...` 엔드포인트를 추가합니다.
5. 인증 필요 여부를 Security 설정에서 확인합니다.
6. 프론트 타입을 작성합니다.
7. `Home.tsx`에서 fetch 함수를 추가합니다.
8. 실패 시 fallback 값을 정합니다.
9. 로딩 상태가 기존 `loading`에 합쳐질지 별도 state가 필요할지 결정합니다.
10. 테스트 또는 수동 검증으로 응답 모양을 확인합니다.

## 43. CSS 수정 체크리스트

홈페이지 CSS는 애니메이션과 반응형 분기가 많으므로 작은 수정도 화면 전체에 영향을 줄 수 있습니다.

1. `.home-lobby`의 padding을 바꾸면 고정 헤더와 모바일 하단 액션을 함께 확인합니다.
2. 카드 border-radius를 바꾸면 모든 카드 계열의 일관성을 확인합니다.
3. `.hero-stats`를 수정하면 모바일 접힘 상태도 확인합니다.
4. `.event-banner-card`의 grid를 바꾸면 이미지 비율과 텍스트 줄바꿈을 확인합니다.
5. `.action-hub` 폭을 바꾸면 오비트 링이 넘치지 않는지 확인합니다.
6. `.mobile-fixed-actions`를 수정하면 Footer, SupportWidget, 브라우저 하단 UI와 겹치지 않는지 확인합니다.
7. 애니메이션을 추가하면 `prefers-reduced-motion` 대응이 필요한지 검토합니다.
8. 한국어 텍스트는 `word-break: keep-all`이 필요한지 확인합니다.

## 44. 코드 읽기 연습: 오늘 출석 상태 추적

초보자가 홈 화면을 이해하려면 오늘 출석 상태 흐름을 직접 따라가면 좋습니다.

1. `Home.tsx`에서 `todayKey`를 찾습니다.
2. `loadLobbyData`에서 `/api/attendance?month=${monthKey}` 요청을 찾습니다.
3. 응답이 `logs` state에 들어가는 위치를 봅니다.
4. `logMap`이 `logs`를 `Map`으로 바꾸는 코드를 봅니다.
5. `todayLog = logMap.get(todayKey)`를 확인합니다.
6. `isAttendanceDone = Boolean(todayLog)`를 확인합니다.
7. `todayLabel`이 "운동 기록 완료", "휴식 기록 완료", "아직 기록 없음" 중 무엇이 되는지 봅니다.
8. `attendance-status`, `action-btn urgent`, `action-btn complete` class가 어떻게 바뀌는지 봅니다.
9. CSS에서 `.attendance-status.done`, `.attendance-status.pending`, `.action-btn.urgent`, `.action-btn.complete`를 확인합니다.

이 흐름을 이해하면 홈 화면의 다른 데이터도 같은 방식으로 추적할 수 있습니다.

## 45. 코드 읽기 연습: 이벤트 배너 추적

이벤트 배너를 따라가려면 다음 순서를 봅니다.

1. `Home.tsx`에서 `activeEvents` state를 찾습니다.
2. `loadActiveEvents` 함수를 찾습니다.
3. `eventApi.getPublicList({ status: "ACTIVE", page: 0, size: 10 })` 호출을 봅니다.
4. `frontend/src/services/eventApi.ts`에서 `getPublicList`가 `/api/events`를 호출하는지 확인합니다.
5. `EventPublicController`의 `@GetMapping`을 찾습니다.
6. `cmsEventService.getPublicList(status, q, pageable)`로 연결되는지 확인합니다.
7. 다시 `Home.tsx`에서 `eventIndex`와 `event-track` transform을 봅니다.
8. CSS에서 `.event-slider`, `.event-track`, `.event-banner-card`를 확인합니다.

이 흐름은 "프론트 state -> 서비스 함수 -> 백엔드 Controller -> 화면 렌더링"을 연습하기 좋습니다.

## 46. 코드 읽기 연습: 라운지 접속자 수 추적

라운지 접속자 수는 백엔드 Spring Boot가 아니라 realtime 서버에서 옵니다.

1. `Home.tsx`에서 `REALTIME_URL`을 찾습니다.
2. `loadLoungeStatus`에서 `${REALTIME_URL}/status` 요청을 봅니다.
3. `payload?.activePlayers`를 숫자로 변환하는 코드를 확인합니다.
4. `loungeCountLabel`이 null일 때 `"--"`가 되는지 봅니다.
5. `realtime/src/server.ts`에서 `req.url?.startsWith("/status")`를 찾습니다.
6. `activePlayers: listPlayers().length`를 확인합니다.
7. `lounge:join`과 `disconnect`에서 플레이어 목록이 어떻게 바뀌는지 봅니다.

이 흐름을 보면 REST API와 realtime 서버가 왜 분리되어 있는지 이해하기 쉽습니다.

## 47. 배포와 환경변수 확인

프론트엔드 배포 시 홈페이지에 영향을 주는 값은 다음입니다.

| 변수 | 필요 이유 |
| --- | --- |
| `VITE_API_BASE` | 백엔드 API 도메인 연결 |
| `VITE_REALTIME_URL` | 라운지 realtime 서버 연결 |

백엔드 배포 시 홈 화면 관련 API에 영향을 주는 값은 다음입니다.

| 변수 | 필요 이유 |
| --- | --- |
| DB 접속 정보 | 출석, 캐릭터, 이벤트, 지표 조회 |
| `JWT_SECRET` | 인증된 개인 데이터 조회 |
| CORS 허용 origin | 프론트 도메인에서 API 호출 허용 |
| `FRONTEND_BASE_URL` | 공유 링크 생성 기능과 간접 연결 |

realtime 배포 시 필요한 값은 다음입니다.

| 변수 | 필요 이유 |
| --- | --- |
| `PORT` | realtime 서버 포트 |
| `ORIGIN` | Socket.IO와 `/status` CORS 허용 origin |

## 48. 검증 명령

홈페이지 변경 후 최소 검증은 다음입니다.

```powershell
cd frontend
npm run build
```

백엔드 API를 함께 수정했다면 다음도 실행합니다.

```powershell
cd backend
.\gradlew.bat test
```

realtime 서버를 수정했다면 다음을 실행합니다.

```powershell
cd realtime
npm run build
```

수동 검증은 다음 경로를 확인합니다.

| 경로 | 확인할 것 |
| --- | --- |
| `/` | 홈 첫 화면, 이벤트 배너, CTA, 모바일 토글 |
| `/attendance` | 출석 기록 후 홈 리액션 |
| `/mypage` | 캐릭터와 통계가 홈 미리보기와 일관되는지 |
| `/lounge` | realtime 접속 후 홈 `/status` 카운트가 변하는지 |
| `/events` | ACTIVE 이벤트가 홈 배너와 일치하는지 |

## 49. 핵심 요약

득근득근 MuscleUp 홈페이지를 이해하려면 다음 다섯 가지를 잡으면 됩니다.

1. `main.tsx`는 앱 시작, 인증 부트스트랩, PWA 업데이트 처리를 담당합니다.
2. `App.tsx`는 `/` 경로를 `Home`에 연결하고, 보호 라우트를 구분합니다.
3. `Home.tsx`는 출석, 캐릭터, 통계, 이벤트, realtime 상태를 모아 메인 로비를 구성합니다.
4. `homeLobby.css`는 게임형 다크 로비의 시각 스타일, 애니메이션, 모바일 접힘 구조를 담당합니다.
5. 백엔드는 출석/캐릭터/신체통계/이벤트/로비 지표를 제공하고, realtime 서버는 라운지 접속자와 실시간 상호작용을 담당합니다.

가장 중요한 실제 흐름은 다음입니다.

```text
출석 기록
  -> AttendanceController/AttendanceService
  -> 월간 로그와 요약 갱신
  -> Home.tsx가 오늘 출석 완료 계산
  -> 액션 허브 완료 상태
  -> 캐릭터 리액션
  -> 라운지와 커뮤니티 CTA로 연결
```

이 구조 때문에 홈페이지는 단순 첫 화면이 아니라, 운동 기록을 캐릭터 성장과 커뮤니티 활동으로 이어주는 서비스의 중심 로비로 동작합니다.
