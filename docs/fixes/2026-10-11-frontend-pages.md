# 2026-10-11 · 프론트 화면 점검 수정 — 출석·AI·갤러리·이벤트·랭킹·관리자·운동 모임·소개

전체 점검에서 나온 화면 문제 중 출석, 출석 공유 카드, AI 코치, 인바디, 갤러리, 이벤트, 랭킹, 관리자, 운동 모임, 마이페이지, 프로그램 신청 화면을 고친 기록.
공용 부품 `lib/toast.ts`(`toast`)와 `lib/httpError.ts`(`httpError`/`friendlyError`)를 썼다. 줄바꿈(CRLF)과 BOM 은 파일마다 원래대로 유지했다.

검증 공통

- `npx tsc -p tsconfig.app.json --noEmit` → 오류 0.
- `node scripts/lint-diff.mjs` → "늘어난 파일 없음". 내 파일은 그대로이거나 줄었다(AttendanceShareView 4→2, Gallery 1→0, Rankings 1→0, AiFitness·Admin 등은 그대로).
- 화면: 로그인 없이 열리는 화면만 직접 띄웠다 — `/gallery`(데스크톱), `/events`, `/events/1`, `/events/999`, `/programs`(375px), `/attendance/share/<slug>`(375px, slug 는 로컬 DB 읽기 전용 조회).
- **로그인이 필요한 화면(출석, AI, 랭킹, 운동 모임, 마이페이지, 관리자)은 이 브라우저에 로그인 정보가 없어 화면으로 확인하지 못했다.** 타입 검사·린트·코드 읽기로만 확인했다. 사용자가 로그인해서 봐야 한다.

---

### 1. 출석 화면: 실제 출석 입력 칸이 맨 아래에 있었다 (A)

- **문제**: `/attendance` 에서 "오늘의 운동 체크" 폼이 달력 → 연속 출석 → 이번 달 요약 → 주간 리포트 → 랭킹 두 개 **다음**, 맨 아래에 있었다. 출석하러 들어와서 한참 스크롤해야 했다. 머리말 위 작은 글씨는 영어 "MUSCLEUP ATTENDANCE ENGINE".
- **원인**: `pages/Attendance.tsx` 의 JSX 순서가 `header → mobile-top-summary → attendance-grid(달력+통계) → log-view → action-card` 였다.
- **고친 코드**
  - `frontend/src/pages/Attendance.tsx` — `Attendance` 컴포넌트
    - 입력 카드(`action-card`) 블록을 통째로 `</header>` 바로 아래로 옮겼다(안쪽 코드는 그대로, 들여쓰기만 2칸).
    - 오늘 기록이 이미 있으면 폼 대신 **"오늘 출석 완료" 요약 카드**를 먼저 보여 준다. 요약에는 운동/휴식, 운동 종류·강도·받은 EXP, 메모, 공유 버튼, "오늘 기록 고치기" 버튼이 있다. 고치기를 누르면 원래 폼이 열리고(제목 "오늘 기록 고치기", "접기" 버튼), 저장하면 다시 요약으로 접힌다.
      ```diff
      + const [editingToday, setEditingToday] = useState(false);
      ...
      + {todayLog && !editingToday ? (
      +   <div className="attendance-card dg-steel action-card today-done-card dg-rise">
      +     <h2>오늘 출석 완료</h2> <p>{todayDoneSummary}</p> ... {shareActions}
      +     <button onClick={() => setEditingToday(true)}>오늘 기록 고치기</button>
      +   </div>
      + ) : (
      +   <div className={`attendance-card dg-steel action-card ...`}> …기존 폼… </div>
      + )}
      ```
    - 공유 버튼 묶음(원클릭 자랑하기 · 링크 복사 · 인스타용 이미지 · 공유 해제)을 `const shareActions` 로 빼서 요약 카드와 폼이 같이 쓴다(같은 버튼을 두 번 쓰지 않음).
    - 머리말 위 글씨: `MuscleUp Attendance Engine` → `오늘의 출석` (`font-num` 제거).
  - `frontend/src/styles/attendance.css` — `.attendance-eyebrow` 의 `letter-spacing: 0.04em; text-transform: uppercase` → `letter-spacing: 0`(한글에 넓은 자간 금지). `.today-done-card`(간격), `.today-done-memo.dg-whiteboard`(기존 `.log-memo` 와 같은 칸) 추가.
- **확인**: 타입 검사. 화면은 로그인이 필요해 **못 봤다**.
- **남은 것**: 로그인 후 데스크톱·375px 에서 ① 오늘 기록 없음 → 폼이 맨 위 ② 저장 → 요약 카드로 접힘 ③ "오늘 기록 고치기" → 폼 → "접기" 를 확인해야 한다.

### 2. 다른 달로 넘기면 오늘 이미 출석했는데도 "출석 기록 저장"이 나왔다 (A, 이동하며 발견)

- **문제**: 입력 카드가 맨 위로 올라오면서 달력 달을 바꿔도 늘 보이게 됐는데, 예전 코드는 "오늘 기록"을 **지금 보고 있는 달 목록**에서만 찾았다. 지난달로 넘기면 `todayLog = null` → 새 출석(POST)을 다시 누를 수 있었다.
- **원인**: `todayLog = useMemo(() => isCurrentMonth ? logs.find(...) : null)` (`Attendance.tsx` 옛 271행).
- **고친 코드**
  - `Attendance.tsx` — `todayLog` 를 따로 상태로 둔다. 이번 달을 불러왔을 때(`reloadMonth`)와 저장 직후에만 갱신한다.
    ```diff
    - const todayLog = useMemo(() => { if (!isCurrentMonth) return null; return logs.find(...) ?? null; }, [...]);
    + const [todayLog, setTodayLog] = useState<AttendanceLog | null>(null);
    + // reloadMonth 안
    + if (monthKey === formatMonthKey(new Date())) setTodayLog(logsRes.find((log) => log.date === todayKey) ?? null);
    + // saveToday 성공 직후
    + setTodayLog((prev) => ({ ...(prev ?? {}), ...res, date: todayKey }));
    ```
  - 폼 값 채우기 effect 의 `if (!isCurrentMonth) return;` 를 없앴다(이제 todayLog 가 늘 오늘 기준). 안 쓰게 된 `isCurrentMonth` 삭제.
- **API**: 그대로. 새 출석은 `POST /api/attendance/today`, 오늘 기록 수정만 `PUT /api/attendance/{오늘}` — 백엔드가 PUT 을 "있는 기록 수정"으로 좁히는 것과 맞다(주석으로 남김).
- **확인**: 타입 검사. 화면 미확인(로그인 필요).

### 3. 출석 달력 요일 머리글이 하루씩 밀림 (A, 백로그)

- **원인**: 날짜 칸은 `new Date(y, m, 1).getDay()`(일요일=0) 기준으로 채우는데 머리글은 `["월", … "일"]`.
- **고친 코드** — `Attendance.tsx` 달력 머리글
  ```diff
  - {["월", "화", "수", "목", "금", "토", "일"].map((label) => (
  + {/* 날짜 칸은 getDay()(일요일=0) 기준으로 채우므로 머리글도 일요일부터 */}
  + {["일", "월", "화", "수", "목", "금", "토"].map((label) => (
  ```
  주간 리포트(`WEEK_LABELS`, 월요일 시작 `startOfWeek`)는 원래 서로 맞아 그대로 뒀다.
- **확인**: 코드 대조(첫 칸 offset = `getDay()`). 화면 미확인.

### 4. `quickShare`·`saveInstaImage` 의 `return` 뒤 죽은 코드 + 쓸모없는 카드 렌더링 (A, 백로그)

- **문제/원인**: 두 함수 모두 공유 카드 화면으로 이동하고 `return;` 한 뒤에 예전 공유·저장 코드 40여 줄이 남아 있었다. 그 코드만 쓰던 `shareImageFile` 상태와, 입력할 때마다 **캔버스로 카드 PNG 를 다시 그리는 useEffect**(`buildShareImageFile`)가 결과를 아무도 안 쓰는데 계속 돌았다.
- **고친 코드** — `Attendance.tsx`
  - `quickShare`, `saveInstaImage` 는 이동 코드만 남김. 삭제: `composeShareText`, `buildShareImageFile`, `shareImageFile` 상태, 카드 미리 그리는 `useEffect`, `withProxy`, `renderAttendanceShareCard` import.
  ```diff
    window.location.assign(`${appShareLinkForSlug(autoSlug)}?auto=share&from=attendance`);
  - return;
  - const ensuredLog = todayLog as AttendanceLog;
  - const nav = navigator as Navigator & { canShare?: ... };
  - … (navigator.share / clipboard 40여 줄)
  ```
  ```diff
  - useEffect(() => { … const imageFile = await buildShareImageFile(); setShareImageFile(imageFile) … },
  -   [todayKey, didWorkout, workoutTypes, workoutIntensity, memo, shareComment, mediaUrls]);
  ```
- **확인**: 타입 검사(남은 참조 없음).

### 5. 출석 화면 오류 문구·알림 (A, M)

- `Attendance.tsx` — `api()` 의 401 처리 `alert("로그인이 필요합니다.")` → `toast(…, "error")`. 실패 응답은 `throw new Error(text || \`HTTP ${status}\`)` → `throw await httpError(res, "요청을 처리하지 못했어요.")`. 각 catch 의 `e?.message || "…"` → `friendlyError(e, "…")`(서버 원문/영어가 화면에 안 나옴).
  ```diff
  - alert("로그인이 필요합니다.");
  + showGlobalToast("로그인이 필요해요. 로그인 화면으로 이동할게요.", "error");
  - throw new Error(text || `HTTP ${res.status}`);
  + throw await httpError(res, "요청을 처리하지 못했어요.");
  ```
  (화면 안의 기존 출석 토스트 `toast` 상태는 EXP 표시가 있어 그대로 두고, 공용 토스트는 `showGlobalToast` 로 이름을 바꿔 불러왔다.)

### 6. 출석 사진 대체 텍스트가 영어 (N)

- `Attendance.tsx` — `alt="attendance archive media"` → `` alt={`${selectedDateKey} 출석 사진 ${idx + 1}`} ``, `alt="attendance media"` → `` alt={`오늘 첨부한 사진 ${idx + 1}`} ``, 첨부 삭제 버튼에 `aria-label="첨부 N 삭제"`.

---

### 7. 출석 공유 카드: 영어 aria-label·영어 설정 이름 (B)

- **문제**: 화면 낭독기가 "홈으로" 버튼을 "go home", "응원하기"를 "send cheer" 로 읽었다(영어 `aria-label` 이 보이는 한국어 글자를 덮어씀). 꾸미기 설정 제목도 "Preset/Theme/Image Ratio/Quote Style/Sticker/Export Quality/Live Thumbnail/Brag Message", 선택지 "Sunset/Mint/Midnight", "Feed 4:5/Square", "Glass/Outline/Solid", "None", "1x PNG".
- **고친 코드** — `frontend/src/pages/AttendanceShareView.tsx`
  - 보이는 한국어 글자가 있는 버튼의 영어 `aria-label` 11개 삭제: `quick share (top)`, `save custom card (top/quick)`, `save preset`, `random recommendation`, `copy message and link`, `send cheer`, `report share`, `go home`.
  - 나머지는 한국어로: 패널 `role="region" aria-label="카드 미리보기"`/`"카드 꾸미기"`, `` `사진 맞춤 ${label}` ``, `테마`, `비율`, `문구 상자`, `` `스티커 ${item || "없음"}` ``, `` `저장 화질 ${scale}배` ``, `캐릭터`, `포즈`, `자랑 멘트`, 템플릿 버튼 `` `템플릿 넣기: ${template}` ``(같은 글자 "템플릿" 버튼 3개를 구분), `"이 공유 페이지 링크 열기"`. `toggle meta` 는 `<label htmlFor>` 가 있어 삭제.
  - 소제목/선택지 한국어: 프리셋·테마·이미지 비율·문구 상자·스티커·저장 화질·미리보기·자랑 멘트 / 노을·민트·한밤 / 피드 4:5·정사각 1:1·스토리 9:16 / 반투명·테두리·단색 / 없음 / N배. 머리말 `Attendance Brag Studio` → `출석 자랑 카드`. 스토리 안전 영역 안내 `Story Safe Area` → `스토리 안전 영역`.
    ```diff
    - <Link to="/" className="action-btn dg-btn dg-btn-steel" aria-label="go home">홈으로</Link>
    + <Link to="/" className="action-btn dg-btn dg-btn-steel">홈으로</Link>
    - aria-label={`sticker ${item || "none"}`}
    + aria-label={`스티커 ${item || "없음"}`}
    ```
  - `frontend/src/styles/attendanceShare.css` — `.share-eyebrow` `letter-spacing: 0.04em; text-transform: uppercase` → `letter-spacing: 0`, `.story-safe` `letter-spacing: 0.08em` → `0`.
- **같이 고친 것**: 스토리 비율에서 점선 "안전 영역" 안내 상자가 캡처 대상(`.share-preview`) 안에 있어 **저장 이미지에 같이 찍힐 수 있었다** → 두 상자에 `data-html2canvas-ignore="true"`.
- **남겨 둔 것**: 카드 그림 안의 영어 장식 글자("ATTENDANCE", "Workout Complete"/"Recovery Day")는 포스터 디자인 요소로 보고 그대로 뒀다. 바꾸려면 카드 디자인 결정 필요.
- **확인**: 375px 에서 `/attendance/share/<slug>` 열어 접근성 트리 확인 — 버튼 이름이 "공유하기", "카드 저장", "사진 맞춤 꽉 채우기" 등 한국어로 나옴. 꾸미기 옵션 펼친 화면은 클릭하지 않아 직접 보진 않았다.

### 8. 출석 공유 카드: `??` 로 깨진 이모지 (B, 백로그)

- **원인**: 커밋 `2de4f34` 에서 이모지가 `??` 로 저장됨. 쓰는 곳을 확인했다:
  - `STICKERS`, `THEME_PACKS[].sticker` → 카드 위에 올라가는 스티커(카드 **내용물**, `sticker && <div className="share-sticker">`)와 스티커 선택 버튼 글자.
  - `DECO_GLYPH.heart/bolt/tape` → 카드에 붙이는 꾸밈 글자.
  - `CHARACTER_POSE_OPTIONS[].emoji`, `CHARACTER_EXPRESSION_OPTIONS[].emoji` → 카드 캐릭터 옆 설명 한 줄(`{activePose.emoji} {label} · {expressionLabel}`)에만 쓰임. 다른 로직은 `id` 만 씀.
  - 저장된 프리셋(`localStorage attendance_share_preset_v1`)에 깨진 `"??"` 스티커가 남아 있을 수 있음.
- **고친 코드** — `AttendanceShareView.tsx`
  - 스티커·꾸밈 글자는 `git show 2de4f34^` 의 원래 값으로 되살림.
    ```diff
    - const STICKERS = ["", "??", "??", "?", "??", "??", "?", "??"];
    + const STICKERS = ["", "🔥", "💪", "✨", "🚀", "🏆", "⚡", "🎯"];
    - heart: "?", bolt: "?", tape: "?",
    + heart: "❤", bolt: "⚡", tape: "▭",
    - sticker: "?" / "???" / "??" / "??"   (cute / retro / gym / comic 테마 팩)
    + sticker: "✨" / "🎞️" / "💪" / "💥"
    ```
  - 포즈·표정 이모지는 UI 장식이라(디자인 규칙: 이모지 아이콘 금지) **필드째 지우고** 글자만 보여 준다.
    ```diff
    - { id: "flex", label: "근육", emoji: "??" },
    + { id: "flex", label: "근육" },
    - const expressionLabel = …?.emoji ?? "??";
    + const expressionLabel = …?.label ?? "";
    - <span>{activePose.emoji} {activePose.label} · {expressionLabel}</span>
    + <span>{activePose.label} · {expressionLabel}</span>
    ```
  - `loadPreset()` — 저장된 스티커에 `?` 가 있으면 "없음"으로.
    ```diff
    - sticker: parsed.sticker ?? DEFAULT_PRESET.sticker,
    + sticker: parsed.sticker && !parsed.sticker.includes("?") ? parsed.sticker : DEFAULT_PRESET.sticker,
    ```
- **남은 것**: 같은 커밋이 `utils/attendanceShareCard.ts`(캔버스 대체 렌더러)도 건드렸다 — 내 담당 파일이 아니라 확인만 못 함. `BragDetail.tsx` 의 `??` 는 커뮤니티 영역.

### 9. 출석 공유: 알림창·서버 원문 오류, 신고 로그인 (B + 백엔드 변경 반영)

- **고친 코드** — `AttendanceShareView.tsx`
  - `alert` 4곳 → `toast`: 프리셋 저장, 이미 응원/신고함, 신고 접수, 멘트+링크 복사. 응원 성공도 "응원을 보냈어요." 토스트.
  - 불러오기/응원/신고 실패: `throw new Error((await res.text()) || \`HTTP …\`)` → `throw await httpError(res, …)`, 화면 문구는 `friendlyError`.
  - **신고는 이제 로그인이 필요하다(백엔드 변경)** → 응원/신고 요청에 `credentials: "include"` 를 붙이고, 401 이면 "로그인하면 신고할 수 있어요."(응원은 "로그인하면 응원할 수 있어요.") 토스트.
    ```diff
    - const res = await fetch(`${API_BASE}/api/attendance/share/${data.shareSlug}/${kind}`, { method: "POST" });
    - if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
    + const res = await fetch(`…/${kind}`, { method: "POST", credentials: "include" });
    + if (res.status === 401) { toast(kind === "report" ? "로그인하면 신고할 수 있어요." : "로그인하면 응원할 수 있어요.", "error"); return; }
    + if (!res.ok) throw await httpError(res, kind === "cheer" ? "응원을 보내지 못했어요." : "신고를 접수하지 못했어요.");
    ```

### 10. 공개 공유 응답에서 memo·reportCount·hiddenByAdmin·id 가 빠져도 화면이 깨지지 않게 (B + 백엔드 변경 반영)

- **배경**: 백엔드가 공개 공유 응답을 `AttendancePublicShareResponse` 로 바꾸며 `id, memo, reportCount, hiddenByAdmin` 을 뺐다.
- **고친 코드** — `AttendanceShareView.tsx`
  - `type ShareData`: `id?`, `cheerCount?: number | null`, `reportCount?: number | null`, `hiddenByAdmin?: boolean | null`(memo 는 원래 선택 값).
  - 카드 메타 줄의 **신고 수 표시 삭제**(공개 카드에 신고 수를 보여 줄 이유가 없고 이제 값도 없음): `응원 {cheerCount} · 신고 {reportCount} · 득근득근` → `응원 {cheerCount ?? 0} · 득근득근`. 렌더러로 넘기는 `cheerCount: data.cheerCount ?? 0`.
  - "오늘의 메모" 칸: 메모가 없으면 칸 자체를 숨긴다(예전엔 "메모 없음"). 공개 화면에선 이제 늘 숨겨진다. 카드 문구 기본값은 `customMessage || shareComment || memo || "오늘 출석 완료!"` 그대로라 memo 가 없어도 shareComment 를 쓴다.
  - 응원/신고 응답으로 상태를 덮어쓸 때 `setData((prev) => (prev ? { ...prev, ...payload } : payload))` — 빠진 필드 때문에 기존 값이 지워지지 않게.
- **확인**: 375px 에서 실제 공유 slug 로 화면이 뜨는 것 확인(콘솔에 내 코드 오류 없음, 401 은 로그인 안 된 캐릭터 조회 요청).

---

### 11. AI 코치: 꾸며낸 숫자와 깜빡이는 LIVE (C)

- **문제**: `/ai` 오른쪽에 "AI 루틴 분석 92% 진행", "30분 체형 교정 DAY 12", "목표 심박 유지 120 bpm", 깜빡이는 빨간 **LIVE** 칩, "분석 응답 3회 / 상담 응답 1건 / 루틴 생성 1.8s" — 모두 코드에 박힌 가짜 값.
- **고친 코드** — `frontend/src/pages/AiFitness.tsx`
  - `liveTiles`(가짜 상태) → `guideTiles`(세 기능이 무엇을 하는지 안내). 칸을 누르면 그 탭으로 이동(`setActiveTab`).
  - LIVE 칩·`animate-ping` 점, "AI Lab", "AI 수행 현황" 카드와 `StatTile` 컴포넌트, 이제 안 쓰는 `useCountUp`/`useInView` import 삭제.
    ```diff
    - const liveTiles = [ { title: "AI 루틴 분석", tag: "분석", status: "92% 진행", … }, … "120 bpm" … ];
    + const guideTiles = [ { tab: "analysis", title: "체성 분석", text: "키·체중·체지방률을 넣으면 …" }, … ];
    - <span className="dg-chip bg-plate-red text-white"><span className="… animate-ping …" />LIVE</span>
    - {[{ label: "분석 응답", value: "3회" }, { label: "상담 응답", value: "1건" }, { label: "루틴 생성", value: "1.8s" }].map(…)}
    + <p>AI 코치 사용법</p><p className="font-display text-3xl">무엇을 할 수 있나요</p> … guideTiles 버튼 …
    ```

### 12. AI 응답을 못 읽으면 JSON 원문이 화면에 (C)

- **원인**: `setAnalysisResult(data.explanation ?? data.content ?? JSON.stringify(data))` 등 3곳(분석·루틴·상담).
- **고친 코드** — `AiFitness.tsx`: 문자열만 고르는 `pickText()` 를 만들고, 없으면 "응답을 해석하지 못했어요. 다시 시도해 주세요."
  ```diff
  - setAnalysisResult(data.explanation ?? data.content ?? JSON.stringify(data));
  + setAnalysisResult(pickText(data.explanation, data.content) ?? UNPARSED_MESSAGE);
  - setPlanResult(data.plan ?? JSON.stringify(data));
  + setPlanResult(pickText(data.plan) ?? UNPARSED_MESSAGE);
  - const answer = data.answer ?? JSON.stringify(data);
  + const answer = pickText(data.answer) ?? UNPARSED_MESSAGE;
  ```
  같이: `callAi` 가 실패하면 다시 throw 해서 세 핸들러에서 **처리되지 않은 Promise 오류**가 났다 → `callAi(...).catch(() => null)` 후 `if (!data) return;`(오류 문구는 `callAi` 가 이미 화면에 띄움).

### 13. AI 코치: 오류 문구·알림창 (C)

- `AiFitness.tsx` — `callAi`, `fetchHistory`, 공유/공유 해제: `throw new Error(text || \`HTTP …\`)` → `httpError`, 화면 문구 `friendlyError`. `alert` 5곳 → `toast`(공유 링크 복사, 공유 실패, 공유 해제 실패, 링크 복사 성공/실패). 공유 해제 성공 토스트 추가.

### 14. 체성 분석이 두 군데(탭과 `/ai/inbody`)인데 안내가 달랐다 (C)

- **고친 코드** — `AiFitness.tsx` 체성 분석 폼 아래에 의료 안내 한 줄과 전체 버전 링크 추가(기능은 지우지 않음).
  ```diff
  + <p className="text-xs text-steel-400">{MEDICAL_NOTICE}</p>   // "의료 진단이 아닌 운동·영양 코칭 참고 자료예요. 질환·통증이 있으면 전문가와 상담해 주세요."
  + <Link to="/ai/inbody" …>인바디 결과지(사진·PDF)로 더 자세히 분석하기</Link>
  ```
- **확인**: 타입 검사. `/ai` 가 로그인 필요 화면으로 바뀌어 있어 **화면 미확인**.

### 15. AI 상담 공유 화면 (M)

- `frontend/src/pages/AiShareView.tsx` — 복사 `alert` 2곳 → `toast`. 불러오기 오류 `httpError`/`friendlyError`. 상담 종류 칩이 서버 코드 그대로 `CHAT` → `TYPE_LABEL`(AI 상담/체성 분석/루틴 설계). 제목 "공유된 Q&A" → "공유된 질문과 답변".

### 16. 인바디 상담: 반투명 흰 배경 (D) + 오류 문구

- `frontend/src/pages/InbodyConsult.tsx` — 상담 방식 버튼(선택 안 됨) `bg-white/60` → 화이트보드 토큰 `bg-board`.
  ```diff
  - : "border-steel-300 bg-white/60 hover:-translate-y-0.5 …"
  + : "border-steel-300 bg-board hover:-translate-y-0.5 …"
  ```
- 같은 파일 분석·직접 입력·재상담 3곳: `throw new Error(text || \`HTTP …\`)` → `httpError(res, "상담 요청을 처리하지 못했어요.")`, `err?.message ?? "…"` → `friendlyError(err, "…")`(4곳).

---

### 17. 갤러리: 남의 사진(Unsplash), 같은 사진 두 번, 개발자 안내, 로그인 없이 업로드 칸 (E, O)

- **문제**: `/gallery` 에 ① 동아리와 상관없는 Unsplash 스톡 사진 3장("Power Session" 등), ② 같은 사진 목록이 "빠른 선택"과 "아카이브 보드"에 두 번, ③ "파일명에 session/challenge/team 키워드를 넣으면 자동 라벨링" 개발자 안내, ④ 로그인 안 해도 업로드 칸, ⑤ "촬영 문의"(mailto:contact@example.com — 가짜 주소) · "제작 프로세스 보기"(→ /programs, 상관없음) 버튼, ⑥ `alt="media-1"`, `"featured media"`, ⑦ 사진 위 `bg-gradient-to-t` 그라데이션, ⑧ `fetch(\`${import.meta.env.VITE_API_BASE}/api/…\`)` — 환경변수가 없으면 `undefined/api/…` 로 요청.
- **고친 코드** — `frontend/src/pages/Gallery.tsx`(파일 대부분 다시 씀, 기능은 목록 조회·선택·업로드 그대로)
  - `editorialCuts`(Unsplash 3장) 삭제. "빠른 선택" 격자 삭제 — 아래 "전체 사진" 한 곳에서 누르면 위 "크게 보기"에 뜬다.
  - 업로드 칸은 운영진만: `readIsAdmin()` — 다른 화면(Header·AdminRoute·BragDetail)처럼 `localStorage.user.role` 에 `ADMIN` 이 들어 있는지. 서버도 업로드 권한을 따로 검사하므로 이건 "보여 줄지"만 정한다.
    ```diff
    - <div className="dg-steel p-6"><UploadDropzone onUploaded={() => fetchList()} /> … 파일명에 session/challenge/team 키워드를 …</div>
    + {isAdmin && (<div className="dg-steel p-6"><p>운영진 전용 · 사진 올리기</p><UploadDropzone … /> … JPG·PNG, 긴 변 2000px 이하를 권장해요.</div>)}
    ```
  - "촬영 문의", "제작 프로세스 보기" 버튼 삭제(사용자 결정).
  - 사진이 없으면 "아직 올라온 사진이 없어요"(운영진에겐 "위의 사진 올리기 칸에서 첫 사진을 올려 주세요."), 불러오기 실패면 "사진을 불러오지 못했어요" + 이유(예: "로그인하면 갤러리를 볼 수 있어요.").
  - `alt` → `"갤러리 사진 N번째"`, `"크게 보는 갤러리 사진 N번째"`. 라벨 칩 SESSION/CHALLENGE/CREW/SNAP → 운동/챌린지/모임/현장(`LABEL_TEXT`, 분류 로직은 그대로).
  - 사진 위 그라데이션 띠 → 사진 **아래** 단색 띠(`border-t-[3px] border-black bg-steel-900`).
  - `const API_BASE = import.meta.env.VITE_API_BASE ?? "";` 로 요청.
  - 영어 "Archive Lab" → "사진 보관함", "갤러리 아카이브" → "갤러리". "상태: 동기화 중/준비 완료" 칸 삭제(의미 없음).
- **확인**: 데스크톱에서 `/gallery` — 로그인 안 한 상태라 401 → "사진을 불러오지 못했어요 / 로그인하면 갤러리를 볼 수 있어요." 칸, 업로드 칸·문의 버튼 안 보임. 사진이 있는 상태·운영진 상태는 **못 봤다**.

### 18. 이벤트 상세: 상태 코드 그대로, 뒤로 가기 없음, 깨진 배너, 빈 버튼, 본문 HTML 그대로 (F)

- **고친 코드**
  - `frontend/src/services/eventApi.ts` — 상태 이름 공용 함수 `eventStatusLabel()` 추가(ACTIVE/ONGOING → "진행 중", SCHEDULED → "예정", ENDED → "종료", DRAFT → "준비 중", HIDDEN → "숨김").
  - `frontend/src/pages/Events.tsx` — `toLabel` 이 이 함수를 쓰게. 머리말 `Event`(font-num) → `동아리 소식`, "로딩 중..." → "불러오는 중...", 썸네일 주소가 없으면 `<img>` 를 그리지 않음.
  - `frontend/src/pages/EventDetail.tsx`(다시 씀)
    - 상태 칩 `{event.status}` → `{eventStatusLabel(event.status)}`.
    - 위·아래에 `/events` 로 가는 "이벤트 목록으로"/"목록으로".
    - 404 는 "찾는 이벤트가 없어요" 빈 화면, 그 밖의 실패는 "이벤트를 불러오지 못했어요"(서버 한국어 메시지만 사용). 숫자가 아닌 id 도 빈 화면.
    - 배너: 주소가 없거나 `onError` 면 이미지 칸을 숨김.
    - CTA: `ctaLink` 가 http(s) 주소이고 `ctaText` 가 있을 때만 버튼 표시(`javascript:` 주소 차단).
    - 본문 `dangerouslySetInnerHTML={{ __html: event.content }}` → **DOMPurify 로 정리한 HTML**. 본문이 비면 칸 숨김.
      ```diff
      + import DOMPurify from "dompurify";
      + const sanitize = (html: string) => DOMPurify.sanitize(html ?? "", { USE_PROFILES: { html: true } });
      - dangerouslySetInnerHTML={{ __html: event.content }}
      + dangerouslySetInnerHTML={{ __html: safeContent }}
      ```
    - 링크 복사 `alert` → `toast`(실패도 안내). 조회수 올리기 실패는 화면에 영향 없게 `.catch`.
  - `frontend/package.json`/`package-lock.json` — `dompurify@^3.2.6` 추가(`npm install dompurify@3.2.6`, 타입 내장).
- **확인**: `/events`, `/events/1`("진행 중", 목록 링크, CTA 링크가 http 가 아니라 버튼 숨김), `/events/999`("찾는 이벤트가 없어요") 화면 확인.
- **남은 것**: 로컬 데이터의 이벤트 1번은 상태가 ACTIVE 인데 기간이 지났다(목록 칩은 "종료", 상세는 "진행 중"). 데이터/스케줄러 문제라 프론트에선 그대로 둠.

### 19. 랭킹 화면 전부 영어 (G)

- `frontend/src/pages/Rankings.tsx`
  - `alert("Login required.")` → `toast("로그인이 필요해요. 로그인 화면으로 이동할게요.", "error")`, 실패 `httpError`/`friendlyError`(`"Failed to load rankings."` → "랭킹을 불러오지 못했어요.").
  - 화면 글자: Character Rankings/Public Rankings → 캐릭터 랭킹/공개 랭킹, 탭 Level/3-Lift → 레벨/3대 중량(`font-num` 제거), My Level Rank/My 3-Lift Rank/Top Percent/Public Total → 내 레벨 순위/내 3대 순위/상위/공개 캐릭터, Loading... → 불러오는 중..., `Lv.N - TIER - Stage N` → `Lv.N · TIER · N단계`, 단위 `3-Lift` → `kg`, "No public characters yet." → "아직 공개된 캐릭터가 없어요."
  - 백엔드가 랭킹 항목에 `selfReported: true` 를 붙임 → 3대 중량 탭에서 "3대 중량은 각자 본인이 입력한 기록이에요. 측정·검증된 값이 아니에요." 안내.
- **확인**: 타입 검사. `/rankings` 가 로그인 필요라 **화면 미확인**.

### 20. 관리자: "예약 작업"이 사실은 이 브라우저에서만 도는 대기열, 입력 칸이 두 군데, 핑크 그라데이션 (H)

- **문제/원인**: `pages/Admin.tsx` 의 "예약 작업"은 `localStorage("admin_schedule_jobs_v1")` 에 저장되고 관리자 화면이 열려 있을 때 `setInterval(10초)` 로만 실행된다. 이름만 보면 서버가 예약 실행하는 것 같다. 같은 입력 칸(종류·상태·시간·예약 생성)이 개요 탭과 운영 탭에 두 번. 통계 카드 색은 `from-pink-500 to-orange-400` 같은 예전 그라데이션 이름.
- **고친 코드** — `frontend/src/pages/Admin.tsx`
  - 안내 상수 `QUEUE_NOTICE = "서버 예약이 아니에요. 이 브라우저에만 저장되고, 관리자 화면을 열어 둔 동안 정한 시간이 지나면 실행돼요. 탭을 닫으면 실행되지 않아요."` 를 두 패널에 표시.
  - 이름: "예약 작업" → "일괄 처리 대기열", 운영 탭 패널 제목 → "일괄 처리 대기열 (이 브라우저에서만 실행)", 버튼 "예약 생성" → "대기열에 추가", "지금 실행" → "시간 지난 항목 지금 실행", 알림 센터 "예약 작업 N건 대기 중" → "일괄 처리 대기열 N건 (이 브라우저에서만 실행)", 진행 표시·성공/오류 문구도 같은 말로.
  - **입력 칸은 운영 탭 하나만**. 개요 탭 패널은 대기 건수·목록 5건·안내 + "운영 탭에서 대기열 관리" 버튼(`setActiveTab("operations")`).
    ```diff
    - <MediaPanel title="예약 작업" description="선택 항목 예약 실행" …> <select…/> <select…/> <input type="datetime-local"…/> <button>예약 생성</button> …
    + <MediaPanel title="일괄 처리 대기열" description="이 브라우저에서만 실행돼요" …> 대기 중 N건 · {QUEUE_NOTICE} · 목록 · <button onClick={() => setActiveTab("operations")}>운영 탭에서 대기열 관리</button>
    ```
  - 색: `accent="from-pink-500 to-orange-400"` 등 6곳 → `plate-red`/`plate-green`/`plate-blue`/`plate-yellow`(`AdminDashboardPanels.plateTone()` 이 이름으로 원판 단색을 고름 — 화면 결과는 단색 그대로, 코드에서 예전 그라데이션 이름만 사라짐).
  - 오류: `throw new Error(text || \`HTTP …\`)` 4곳 → `httpError`, `e?.message || "…"` 16곳 → `friendlyError(e, "…")`.
- **확인**: 타입 검사. 관리자 로그인이 필요해 **화면 미확인**.
- **남은 것**: 진짜 예약 실행이 필요하면 서버 스케줄러가 있어야 한다(백엔드 작업).

### 21. 운동 모임 허브: 숫자 0 과 영어 머리말 (I)

- **문제**: `/crew` 머리 칸이 "내 모임 0 / 전체 모임 0 / 참여 인원 0" 인데 아래 목록엔 내 모임 2개.
- **원인(메인 세션이 측정)**: 숫자 계산(`groups.filter(g => g.joined).length` 등)은 맞고, 카운트업 훅 `hooks/useCountUp.ts` 가 탭이 가려져 있을 때 애니메이션을 시작하지 않아 0 에 멈춤. **그 훅은 메인 세션이 고친다(내 담당 아님).**
- **고친 코드** — `frontend/src/pages/CrewHub.tsx`: 오른쪽 위 `MuscleUp` 칩 삭제, `Crew Hub`(font-num) → `운동 모임`, 활동 칩 LEGEND/HYPE/START → 큰 모임/활발/새 모임, "오늘 인기 모임 · TOP 3" → "인기 모임 · 인원 많은 순 3곳"(실제 기준이 인원 수라서).
- **확인**: 타입 검사. 로그인 필요라 화면 미확인 — 훅 수정 뒤 숫자가 목록과 맞는지 다시 봐야 한다.

### 22. 모임 챌린지: 주지 않는 "+N EXP" 약속, 영어 (J, M)

- **원인**: `questReward = (주간 운동 + 1) * 12 + (출석률 ≥ 80 ? 18 : 8)` 는 화면에서만 계산되고 서버가 경험치로 주지 않는다. 그런데 "미션 성공 보상 +N EXP" 로 표시.
- **고친 코드** — `frontend/src/pages/CrewChallenge.tsx`
  ```diff
  - <span className="text-xs font-bold">미션 성공 보상</span>
  - <span className="font-num text-2xl font-black">+<CountNumber value={questReward} /> EXP</span>
  + <span className="text-xs font-bold">미션 목표 점수<span className="block …">참고용 · 경험치로 지급되지 않아요</span></span>
  + <span className="font-num text-2xl font-black"><CountNumber value={questReward} />점</span>
  ```
  - 영어: `Crew Challenge Arena` → `운동 모임 챌린지`, `Today Quest` → `오늘의 미션`, `Battle Status` → `순위 현황`, 순위 배지 `CROWN`/`TOP2` → `1위`/`2위`, "관리 모드 ON" → "관리 모드 켜짐", 오른쪽 위 `MuscleUp` 칩 삭제.
  - 가입 신청 대기 `window.alert(result.message)` → `toast(...)`.
- 다른 모임 화면: `CrewLobby.tsx` 머리말 `Crew Lobby Live Feed` + 깜빡이는 빨간 점(실시간 아님) → `운동 모임 로비`(점 삭제). `CrewHighlights.tsx` `Crew Weekly Highlights` → `운동 모임 주간 하이라이트`.
- 용어: 내 담당 Crew* 화면에 사용자에게 보이는 "크루"는 없었다(코드 이름은 그대로).

### 23. 모임: 모임원이 아니면 초대 코드 없음 + 합계만 (백엔드 변경 반영)

- **배경**: 백엔드가 모임원이 아니면 `inviteCode = null`, 그리고 `memberDetailVisible, memberCount, monthWorkoutTotal, averageAttendanceRate` 를 준다.
- **고친 코드**
  - `frontend/src/types/crew.ts` — `CrewListItem.inviteCode`, `CrewDetail.inviteCode` → `string | null`; `CrewDetail` 에 위 4개 선택 필드 추가. (`CrewJoinResult.inviteCode` 는 참여한 사람에게 주는 값이라 그대로.) 이 파일은 LF/CRLF 가 섞여 있어 줄 단위로 각 줄의 원래 줄바꿈을 지켜 넣었다.
  - `CrewChallenge.tsx` — 초대코드 줄은 `detail.inviteCode` 가 있을 때만. `memberDetailVisible === false` 면 "모임에 참여하면 멤버별 출석 기록을 볼 수 있어요. / 멤버 N명 · 이번 달 운동 합계 N회 · 평균 출석률 N%" 칸. `copyInviteLink` 는 코드가 없으면 아무것도 안 함. 멤버/순위 목록이 비어 오거나 null 이어도 안 깨지게 `detail.competitionBoard ?? []` 2곳.
- **확인**: 타입 검사. 화면 미확인(로그인 필요).

### 24. 캐릭터 머리 위 빨간 "탈락위기" (K)

- **문제**: 2주 넘게 출석이 적으면(`attendanceRisk === "critical"`) 캐릭터 위에 빨간 "탈락위기" 띠. 마이페이지 컨디션도 빨간 "탈락위기", 경고 단계는 "경고".
- **고친 코드**(판정 로직은 그대로)
  - `frontend/src/components/avatar/AvatarRenderer.tsx` — `{"탈락위기"}` → `{"다시 시작해요"}`.
  - `frontend/src/components/avatar/avatar.css` — `.avatar-risk-banner.critical` 빨강(`#d9302a`/흰 글자) → 노랑(`#f0be2e`/먹색 글자).
  - `frontend/src/pages/MyPage.tsx` — 컨디션 문구 "탈락위기"/"경고" → "다시 시작해요"/"조금 쉬었어요", critical 색도 빨강 → 노랑(경고와 같은 색).
- **남은 것**: `pages/DevAvatars.tsx`(내 담당 아님)의 칸 이름 "탈락위기"는 그대로.

### 25. 마이페이지: 알림창·영어 작은 글씨·레벨 진행 (M + 백엔드 변경 반영)

- `MyPage.tsx` — 401 `alert` → `toast`, 실패 `httpError`. 제목 옆 `MY PAGE`, `UNLOCK` 영어 작은 글씨 삭제.
- 백엔드 캐릭터 응답의 새 값(`exp, expToNextLevel, levelProgress, attendancePoints, hasBodyStats`)을 `CharacterProfile` 타입에 선택 값으로 추가. 캐릭터 카드 아래에 `levelProgress` 가 있으면 "다음 레벨까지" 막대(`role="progressbar"`, `exp / expToNextLevel` 또는 %), `hasBodyStats === false` 면 "체성분 정보를 입력하면 레벨에 반영돼요."
- **확인**: 타입 검사. 화면 미확인(로그인 필요).

### 26. 프로그램 신청: 두 번 눌리면 두 번 접수, 이름·이메일 매번 입력 (L, O)

- **고친 코드** — `frontend/src/pages/Programs.tsx`
  - `submitting` 상태: 제출 중엔 `if (submitting) return;`, 버튼 `disabled`·`aria-busy`, 글자 "신청 보내는 중...".
  - 로그인 정보(`localStorage.user` 의 `name`→없으면 `nickname`, `email`)로 이름·이메일을 처음에 채움(고칠 수 있음).
  - `fetch(\`${import.meta.env.VITE_API_BASE}/api/programs/apply\`)` → `API_BASE`(`?? ""`).
  - 실패: `throw new Error(text || \`HTTP …\`)` → `httpError(response, "신청을 접수하지 못했어요.")`, 화면 `friendlyError`.
  ```diff
  - <button type="submit" className="dg-btn dg-btn-primary mt-6 w-full min-h-[56px] text-base">
  + <button type="submit" disabled={submitting} aria-busy={submitting} className="…">
  +   {submitting ? "신청 보내는 중..." : `${selectedProgram.title} 신청하기`}
  ```
- **확인**: 375px 에서 `/programs` 가 뜨고 제출 버튼 "입문반 신청하기" 확인. 실제 제출은 데이터가 생겨 누르지 않았다.

### 27. `VITE_API_BASE` 를 `?? ""` 없이 쓰던 곳 (O)

- `Gallery.tsx`, `Programs.tsx` 2곳 고침(위 17·26). 내 담당 파일에 남은 곳 없음(`grep 'import.meta.env.VITE_API_BASE}'` 0건).

---

## 남은 것 (다른 영역 필요)

- `hooks/useCountUp.ts` — 운동 모임 허브 숫자 0 의 실제 원인. 메인 세션이 수정 중. 수정 뒤 `/crew` 숫자 확인 필요.
- `utils/attendanceShareCard.ts` — 커밋 `2de4f34` 의 `??` 손상이 이 파일에도 있을 수 있음(내 담당 아님).
- `pages/DevAvatars.tsx` — "탈락위기" 칸 이름.
- `pages/Crew.tsx` — 다른 에이전트가 지운 것으로 보임(작업 트리에서 D). 그 파일의 `window.confirm` 등은 손대지 않음.
- `docs/fix-log.md` — "남은 문제" 표에서 이번에 고친 줄(달력 요일 머리글, `quickShare`·`saveInstaImage` 죽은 코드, `AttendanceShareView.tsx` 의 `??` 이모지 — BragDetail 쪽은 남음)은 기록 정리 담당이 지워야 한다.
- 관리자 일괄 처리를 진짜 예약으로 하려면 서버 스케줄러(백엔드).
- 로그인이 필요한 화면 전부(출석·AI·랭킹·모임·마이페이지·관리자)는 사용자가 로그인해 데스크톱/375px 로 확인해야 한다.
