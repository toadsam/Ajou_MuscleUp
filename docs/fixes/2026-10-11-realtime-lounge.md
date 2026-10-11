# 2026-10-11 실시간 서버 · 라운지 · 친구 수정 기록

전체 점검 항목 2 · 3 · 21 · 40(일부)과 라운지/친구 화면 지적을 고친 기록이다.
양식은 [README](README.md) 를 따른다.

## 배포할 때 꼭 할 일 (먼저 읽기)

| 어디 | 환경변수 | 값 | 없으면 |
|---|---|---|---|
| 백엔드 | `REALTIME_TICKET_SECRET` (= 프로퍼티 `realtime.ticket.secret`) | 32자 이상 임의 문자열 | `prod` 프로필: `POST /api/realtime/ticket` 이 503 → 라운지·친구 실시간 꺼짐. 그 밖 프로필: 개발용 고정값 사용 + 경고 로그 |
| 실시간 서버 | `REALTIME_TICKET_SECRET` | **백엔드와 같은 값** | `NODE_ENV=production`: 모든 연결 거절(`realtime_unavailable`). 그 밖: 개발용 고정값 + 입장권 없는 손님 입장 허용 + 경고 로그 |
| 실시간 서버 | `NODE_ENV` | `production` | 위 개발 모드가 켜진다(배포에서 반드시 설정) |
| 실시간 서버 | `ORIGIN` | 프론트 주소(쉼표로 여러 개) | 기존과 같음: `http://localhost:5173` 만 허용. production 이면 경고 로그 |
| 프론트(빌드 시) | `VITE_REALTIME_URL` | 실시간 서버 주소 | 배포 빌드: 라운지·친구 실시간을 끄고 안내 문구만(더 이상 `localhost:4001` 로 요청하지 않음). 개발 서버에서만 `localhost:4001` |

- 비밀값 만들기 예: `openssl rand -base64 48`. 두 서버에 같은 값을 넣고 두 서버를 함께 재시작한다.
- 백엔드는 새 컨트롤러(`RealtimeTicketController`)와 친구 검색 API 가 생겼으므로 **재배포/재시작이 필요**하다.
  로컬 8080 백엔드도 재시작해야 입장권이 발급된다(재시작 전에는 입장권 404 → 개발 모드 손님 입장으로 동작).
- `SecurityConfig` 는 손대지 않았다. `/api/realtime/ticket` 은 기존 `anyRequest().authenticated()` 에 걸려
  로그인한 사람만 받는다(확인: 토큰 없이 POST → 401). 별도 규칙은 필요 없다.

---

### 1. 라운지에 들어가면 다른 사람 화면에 내 이메일이 퍼지고, 이름·레벨·티어를 마음대로 속일 수 있었다 (항목 2, HIGH)

- **문제**: 라운지에 들어온 모든 사람의 이메일이 `lounge:players` 로 방 전체에 60ms 마다 뿌려졌다. 또 개발자 도구로
  `lounge:join` 을 직접 보내면 닉네임·레벨·티어·성장 수치를 아무 값으로 바꿔 들어올 수 있었다.
- **원인**
  - `realtime/src/server.ts:161` `// TODO: Verify JWT/access token in realtime server (MVP skips).` — 소켓 인증이 없었다.
  - `frontend/src/pages/Lounge.tsx:557` `userId: user.email` 로 이메일을 보냄 → `realtime/src/rooms.ts:348` `userId: payload.userId` 저장
    → `listPlayers()` 가 그대로 `io.to(roomName).emit("lounge:players", …)` (`server.ts:107`).
  - `server.ts:77-103` `isValidJoinPayload` 는 형식만 보고 값은 클라이언트 것을 그대로 썼다.
- **설계**: (a) 백엔드가 짧은 서명 입장권을 발급하고 실시간 서버가 서명을 확인하는 방식.
  프론트는 액세스 토큰을 `localStorage.user.accessToken` 에 두고 `Authorization: Bearer` 로 보낸다
  (`frontend/src/lib/installFetchAuth.ts`). 실시간 서버가 매 연결마다 백엔드를 부르는 (b) 보다 서버 간 의존이 없고 빠르다.
  - 입장권 = `base64url(JSON) + "." + base64url(HMAC-SHA256(앞부분, REALTIME_TICKET_SECRET))`, 유효 2분.
  - 내용: `uid`(DB id, 친구 알림에만 사용·방송 안 함), `pid`(공개 id = HMAC("pid:"+uid) 앞 16자리), `nick`, `lv`, `tier`, `stage`,
    `gender`, `seed`, `style`, `rest`, `gp`(성장 수치), `fr`(친구 id 최대 500), `iat`, `exp`. **이메일은 넣지 않는다.**
  - 실시간 서버는 이름·레벨·티어·아바타·성장 수치를 **입장권에서만** 읽는다. 클라이언트가 보내도 되는 건 꾸밈용 4개
    (MBTI, 최근 출석 수, 진행 중 이벤트 제목·진행도)뿐이고 형식·길이를 제한한다.
- **고친 코드**
  - `backend/.../controller/RealtimeTicketController.java` (새 파일) — `issue()`: `POST /api/realtime/ticket`.
    `CharacterService.getOrCreateProfile`, `FriendService.findFriendIds` 로 내용을 채우고 HMAC 서명. 생성자에서 비밀값을 정한다
    (32자 이상이면 사용 / `prod` 프로필인데 없으면 `null` → 503 / 그 밖엔 개발용 고정값 + 경고).
    ```diff
    + @PostMapping("/ticket")
    + public ResponseEntity<Map<String, Object>> issue(@AuthenticationPrincipal String email) {
    +     ...
    +     String ticket = body + "." + b64(hmac(body.getBytes(StandardCharsets.US_ASCII)));
    ```
  - `realtime/src/auth.ts` (새 파일) — `verifyTicket()`: `timingSafeEqual` 로 서명 비교, `exp`/`iat`(30초 오차 허용), `uid`, `pid` 형식, `fr` 정리.
    `authMode`: `ticket` | `dev` | `disabled`.
  - `realtime/src/server.ts` — `io.use(...)` 핸드셰이크 미들웨어: 입장권이 있으면 확인(틀리면 `unauthorized` 로 거절),
    없으면 `dev` 모드에서만 손님 입장, 그 밖엔 거절. `disabled` 면 전부 `realtime_unavailable`.
    ```diff
    - socket.on("lounge:join", (payload) => {
    -   // TODO: Verify JWT/access token in realtime server (MVP skips).
    -   if (!isValidJoinPayload(payload)) { ... }
    -   const player = addPlayer(socket.id, { ...payload, nickname });
    + io.use((socket, next) => { ... verifyTicket(ticket) ... });
    + on("lounge:join", "join", (payload) => {
    +   const profile = identity ? profileFromTicket(identity) : profileFromGuestPayload(socket.id, payload);
    +   const player = addPlayer(socket.id, profile, extrasFromPayload(payload));
    ```
    `profileFromTicket` / `profileFromGuestPayload`(개발 모드 전용) / `extrasFromPayload`(MBTI 는 `^[EI][NS][TF][JP]$`,
    출석 수 0~366 정수, 이벤트 제목 40자, 진행도 `^\d{1,4}/\d{1,4}$`) 로 나눴다. 채팅 내용은 더 이상 서버 로그에 남기지 않는다.
  - `realtime/src/types.ts` — `PlayerState.userId` 삭제, `id`(공개 id) 추가. `VerifiedProfile` / `ClientExtras` / `GROWTH_PARAM_KEYS` 추가.
  - `realtime/src/rooms.ts` — `addPlayer(socketId, profile, extras)` 로 바꿈(클라이언트 객체를 통째로 펼치지 않음).
  - `frontend/src/lib/realtime.ts` (새 파일) — `REALTIME_URL`, `fetchRealtimeTicket()`, `realtimeAuth(cb)`(socket.io `auth` 콜백이라
    재연결 때마다 새 입장권), `realtimeConnectError(err)`(거절 이유 → 한국어).
  - `frontend/src/pages/Lounge.tsx` — 소켓 생성에 `auth: realtimeAuth`, `connect_error` 처리, join 에서 이메일 제거.
    ```diff
    - const socket = io(REALTIME_URL, { transports: ["websocket"] });
    + const socket = io(REALTIME_URL, { transports: ["websocket"], auth: realtimeAuth });
    ...
    -   userId: user.email,
    ```
    `type PlayerState` 의 `userId?` → `id?`(공개 id).
- **확인**
  - `realtime`: `npx tsc --noEmit`, `npm run build` 통과. 백엔드 `compileJava` 통과(BUILD SUCCESSFUL).
  - 4011 포트에 새 서버를 따로 띄우고 socket.io-client 스크립트로 직접 호출:
    - 서명을 바꾼 입장권 → `unauthorized`, 만료 입장권 → `unauthorized`, 올바른 입장권 3개 → 연결.
    - 입장권 주인 A 가 `{nickname:"FAKE", level:999, tier:"CHALLENGER", userId:"leak@x.com", growthParams:{huge:"x"*1000}}` 로 join →
      다른 사람이 받은 A 는 `nickname:"Alice", level:7, tier:"GOLD"`(입장권 값), `userId`/이상한 growthParams 없음,
      목록 전체 JSON 에 `@` 없음.
  - Java(백엔드와 같은 방식)로 서명한 입장권을 Node 서버가 받아들이는 것 확인(형식 호환).
  - `NODE_ENV=production` + 비밀값 없음 → 입장권 없는 연결 `realtime_unavailable`. production + 비밀값 있음 → 입장권 없는 연결 `unauthorized`.
  - 로컬 4001(tsx watch 로 새 코드가 올라가 있음)에 엉터리 입장권 → `unauthorized`.
- **남은 것**
  - 로그인한 상태로 실제 백엔드 입장권 → 라운지 입장 흐름은 화면으로 확인하지 못했다(Google 로그인은 사용자만 가능, 8080 백엔드는
    아직 재시작 전이라 새 엔드포인트가 없음). 재시작 뒤 라운지에 들어가 다른 사람 목록이 보이는지 확인 필요.
  - 입장권 안의 레벨·친구 목록은 "연결한 순간" 값이다. 라운지에 있는 동안 레벨이 올라도 다시 들어오기 전까지는 예전 값이 보인다.

### 2. 친구 1:1 채팅방에 남이 끼어들거나 가짜 메시지를 넣을 수 있었다 (항목 3, HIGH)

- **문제**: 아무나 `friend:join {userId: "남의 이메일"}` 로 남이 되고, `friend:subscribe` 로 아무 방이나 들어가 대화를 엿보고,
  `friend:send` 로 크기 제한 없는 아무 객체를 "메시지"로 밀어 넣을 수 있었다.
- **원인**: `realtime/src/server.ts:129-158` — `friend:join` 이 클라이언트가 준 `userId` 를 그대로 믿음, `friend:subscribe` 는 친구인지 확인 없이
  `socket.join(getFriendRoom(myId, peerId))`, `friend:send` 는 `message` 객체를 그대로 방에 방송.
- **고친 코드**
  - `realtime/src/server.ts` — 세 이벤트를 지우고 `friend:notify` 하나로 바꿨다. 입장권이 확인된 소켓은 접속 때 자동으로 `user:<uid>` 방에 들어간다.
    알림은 **입장권의 친구 목록(`fr`)에 있는 상대에게만**, **`{fromUserId, messageId}` 만** 보낸다. 내용은 보내지 않는다.
    ```diff
    - socket.on("friend:send", (payload) => { ... io.to(getFriendRoom(myId, peerId)).emit("friend:message", { from, to, message }); });
    + on("friend:notify", "friend", (payload) => {
    +   if (!Number.isSafeInteger(peerId) || !friendIds.has(peerId)) return;
    +   io.to(`user:${peerId}`).emit("friend:notice", { fromUserId: identity.uid, messageId });
    + });
    ```
  - `frontend/src/pages/Friends.tsx` — 메시지는 REST(`POST /api/friends/chat/rooms/{id}/messages`, 백엔드가 친구인지 확인)로 저장하고,
    소켓으로는 `friend:notify` 만 보낸다. `friend:notice` 를 받으면 열린 대화면 REST 로 다시 읽고, 아니면 친구 목록에 "새 메시지" 표시.
    친구 목록이 바뀌면(수락 등) `socket.disconnect().connect()` 로 새 입장권을 받아 다시 붙는다(`loadAll` 안 `friendIdsKeyRef`).
    실시간에 못 붙으면 열린 대화를 15초마다 다시 읽는다(`FALLBACK_POLL_MS`).
- **확인**: 4011 테스트 서버에서 A(친구 [2]) 가 2번에게 알림 → 2번(B) 만 `{"fromUserId":1,"messageId":10}` 수신, 친구 아닌 3번 대상 알림은 버려짐.
  프론트 타입 검사 통과.
- **남은 것**: 로그인 상태에서 두 계정으로 실제 주고받기는 확인 못 함(로그인 필요). 친구를 삭제한 뒤에도 상대가 연결을 끊기 전까지는
  "새 메시지 있음" 알림만 올 수 있다(내용은 REST 가 막으므로 새는 것은 없음).

### 3. 실시간 서버가 쉽게 과부하되거나 큰 데이터를 퍼뜨릴 수 있었다 (항목 21)

- **문제**: 한 명이 큰 `growthParams` 객체나 긴 문자열로 들어오면 그 내용이 60ms 마다 모든 사람에게 다시 전송됐다. 플레이어 한 명만 움직여도
  전원 목록 전체를 보냈다. 음성 조각(최대 180KB)은 보이스를 끈 사람에게도 방 전체로 갔다. 채팅·이동·파티 요청에 횟수 제한이 없었다.
- **원인**: `server.ts:90`(growthParams 는 `typeof === "object"` 만 확인), `:111-115`(60ms 전체 목록), `:240-253`(voice → `socket.to(roomName)`),
  socket.io 기본 `maxHttpBufferSize` 1MB, 이벤트별 제한 없음.
- **고친 코드**
  - `realtime/src/server.ts`
    - 필드 화이트리스트: `sanitizeGrowthParams`(알려진 19개 숫자 키만, -10~10, 하나라도 없으면 통째로 버림), `cleanText`(제어문자·방향 제어문자 제거 +
      길이 제한), 아바타 시드 64자 · 스타일 32자 · 닉네임 30자 · 채팅 200자.
    - `maxHttpBufferSize: 48 * 1024`(메시지 하나 48KB 넘으면 연결 끊김), 음성 조각 base64 32,000자 이하, mimeType 형식 확인.
    - 위치 방송: 전체 목록(`lounge:players`)은 입장·퇴장 때만. 위치는 `lounge:moves {moves:[{socketId,x,y}]}` 로 **움직인 사람만 100ms 마다**.
    - 음성: `voice:listen {enabled}` 로 보이스를 켠 사람만 `voice-listeners` 방에 넣고, 그중 **260px 안에 있는 사람에게만** 보낸다.
    - 파티 요청은 라운지에 실제로 있는 소켓에게만. 순간이동 수락 좌표는 클라이언트 값이 아니라 서버가 아는 수락자 위치를 쓴다.
    - 이모트/스티커는 정해진 4개 id 만 통과(`EMOTE_VALUES`, `STICKER_VALUES`).
    ```diff
    - setInterval(() => { if (!pendingBroadcast) return; pendingBroadcast = false; broadcastPlayers(); }, 60);
    + setInterval(() => { const moves = takeMoves(); if (moves.length === 0) return;
    +   io.to(roomName).emit("lounge:moves", { moves }); }, MOVES_BROADCAST_MS);
    - socket.to(roomName).emit("voice:chunk", { ... });
    + for (const listenerId of listeners) { ... if (Math.hypot(other.x - me.x, other.y - me.y) > VOICE_RANGE) continue; io.to(listenerId).emit("voice:chunk", message); }
    ```
  - `realtime/src/rateLimit.ts` (새 파일) — `SocketRateLimiter`: 소켓별·종류별 토큰 버킷. 넘친 이벤트는 조용히 버리고, 1분에 300번 넘게 버려지면 연결을 끊는다.
    이동 40개/초당 25, 채팅 5개/2초에 1, 입력중 6/2, 이모트 4/1, 파티 4/0.5, 음성 12/5, 핑 4/2, 친구 알림 5/1, 입장 3/0.1.
  - `realtime/src/rooms.ts` — `updatePlayerPosition` 이 좌표를 0.1 단위로 반올림하고 바뀐 경우만 `dirty` 에 넣는다. `takeMoves()` 추가.
  - `frontend/src/pages/Lounge.tsx` — `lounge:players` 처리 본문을 `applyPlayers(nextPlayers)` 로 빼고, `lounge:moves` 는 마지막 목록에 좌표만 합쳐
    같은 함수로 넘긴다(방향·걷기 애니메이션·내 위치 보정 로직은 그대로). 연결 시와 보이스 토글 시 `voice:listen` 전송.
  - `realtime/bench/lounge-ramp.mjs` — `lounge:moves` 도 수신량에 세도록 한 블록 추가(입장권 없이 붙으므로 개발 모드에서만 돈다).
- **확인**: 테스트 서버에서 채팅 20개 연속 → 5개만 전달. 이동 20번 → `lounge:moves` 1묶음. 60KB 메시지 → 서버가 연결 종료(`transport close`).
- **남은 것**: 벤치(`npm run bench`)는 다시 돌리지 않았다. 포트폴리오 램프 표의 "브로드캐스트/s" 는 옛 설계(60ms 전체 목록) 값이므로 다시 재야 한다.

### 4. 라운지 오류가 영어로 나왔다

- **원인**: `Lounge.tsx:519,539` `"Failed to load character data."`, `:807` `"Failed to connect to lounge."`, 서버 응답 원문도 그대로 표시.
- **고친 코드**: `Lounge.tsx`
  ```diff
  - throw new Error(text || "Failed to load character data.");
  + if (!loungeRes.ok) throw await httpError(loungeRes, "캐릭터 정보를 불러오지 못했어요.");
  - setError(err?.message ?? "Failed to load character data.");
  + setError(friendlyError(err, "캐릭터 정보를 불러오지 못했어요."));
  - setError(payload?.message ?? "Failed to connect to lounge.");
  + setError("라운지에 들어가지 못했어요. 새로고침해 주세요.");
  ```
  소켓 연결 거절은 `realtimeConnectError`(로그인 만료 / 지금은 쓸 수 없음 / 연결 실패) 문장으로, 연결되면 오류를 지운다.
- **확인**: 타입 검사 통과. 화면은 로그인 필요로 못 봄.

### 5. 채팅 "신고" 버튼이 알림창만 띄우고 아무 데도 접수되지 않았다

- **원인**: `Lounge.tsx:3304` `onClick={() => alert(\`신고가 접수되었습니다: ${msg.nickname}\`)}`.
- **고친 코드**: `Lounge.tsx` — `reportChatMessage(nickname, message, ts)` 추가. 확인창 → `POST /api/support/inquiries`
  (자랑방 신고 `BragDetail.tsx` 와 같은 API, 관리자 문의 화면에서 보임)에 `라운지 채팅 신고 / 대상 / 메시지(600자) / 보낸 시각`, `page: "/lounge"` 로 접수 →
  `toast("신고를 접수했어요. 운영진이 확인할게요.", "success")`. 같은 메시지 중복 신고는 막는다(`reportedChatRef`).
  ```diff
  - onClick={() => alert(`신고가 접수되었습니다: ${msg.nickname}`)}
  + onClick={() => void reportChatMessage(msg.nickname, msg.message, msg.ts)}
  ```
- **확인**: 타입 검사 통과. `/api/support/**` 는 `SecurityConfig` 에서 `permitAll`. 실제 접수는 로그인 화면이 필요해 못 봄.
- **남은 것**: 문의 테이블에 "신고" 종류 칸이 없어 메시지 첫 줄로 구분한다.

### 6. 이모트·스티커 버튼이 영어 대문자와 이모지였다

- **원인**: `Lounge.tsx:1291-1292` `EMOTES = ["wave","cheer","gg","clap"]`, `STICKERS = ["🔥","💪","👏","🚀"]` 를 그대로 버튼 글자로 사용(`uppercase`).
- **고친 코드**: `Lounge.tsx` — 서버로 보내는 id 는 그대로 두고 `EMOTE_LABELS`(손 흔들기/응원/수고/박수), `STICKER_LABELS`(불타요/근육/짝짝/가즈아)로
  버튼 글자와 캐릭터 머리 위 말풍선을 바꿨다.
  ```diff
  - className="lounge-ctl font-num text-[13px] uppercase"> {emote}
  + className="lounge-ctl text-[13px]"> {EMOTE_LABELS[emote]}
  - <div className="sticker-bubble">{stickerMap[player.socketId].sticker}</div>
  + <div className="sticker-bubble">{STICKER_LABELS[stickerMap[player.socketId].sticker] ?? ""}</div>
  ```
- **확인**: 타입 검사 통과. 화면 미확인(로그인 필요).

### 7. 게임 화면이 조작 버튼 줄들에 밀려 화면 아래로 내려가 있었다

- **원인**: 왼쪽 열 순서가 `머리말 → 상태 줄 → 소셜/보이스/타임어택 패널(3줄 + 파티 초대) → 게임 화면` 이었고, 게임 화면 높이가 `78vh` 고정.
- **고친 코드**: `Lounge.tsx`, `src/styles/lounge.css`
  - 소셜·보이스·품질·타임어택 패널을 게임 화면 **아래**로 옮기고 접을 수 있게 만들었다(`.lounge-tools`, `.lounge-tools-toggle`,
    상태 `toolsOpen` — 기본은 데스크톱 펼침/모바일 접힘). 전에는 데스크톱에서만 보이던 이 패널을 모바일에서도 접힌 채로 쓸 수 있다.
  - 파티 초대(따라가기·순간이동 요청)는 놓치면 안 되므로 있을 때만 게임 화면 위에 작은 줄로 남겼다.
  - 머리말을 줄였다(`space-y-8`→`space-y-4`, 제목 한 단계 작게, 설명 문장은 모바일에서 숨김).
  - 데스크톱 게임 화면 높이: `h-[78vh]` → `h-[min(78vh,calc(100dvh_-_19rem))] min-h-[420px]` (첫 화면 안에 들어오게).
- **확인**: 타입 검사, 린트(오류 0). **화면은 못 봤다**: 미리보기 브라우저가 로그인 상태가 아니어서 `/lounge` 가 `/login` 으로 돌아간다.
- **남은 것**: 로그인 후 데스크톱과 375px 에서 게임 화면이 첫 화면에 다 들어오는지, 접기 버튼이 손가락으로 누르기 편한지 직접 확인 필요.

### 8. 라운지 디자인 규칙 위반 두 곳

- `Lounge.tsx` 오류 상자 `text-rose-300` → `text-chalk` (+ `role="alert"`). 테두리는 원래대로 `border-l-plate-red`.
- `Lounge.tsx:2887` `aria-label="Mini map navigation"` → `"미니맵: 누른 곳으로 이동"`.

### 9. 친구를 추가하려면 상대 이메일을 알아야 했고, "실시간 연결: 연결 끊김" 같은 기술 문구가 보였다. 친구 화면에 이메일이 노출됐다

- **원인**: `Friends.tsx:233-245` 이메일 입력칸만 있음, `:225` 연결 상태 문구, `:261,292,313,343` 이메일 표시.
  백엔드 `FriendRequestResponse` 에 `requesterEmail/receiverEmail`, `FriendSummaryResponse` 에 `email` 이 있었다.
  닉네임 검색을 열면 "검색 → 요청 → 보낸 요청 목록"으로 아무나의 이메일을 알아낼 수 있게 되므로 응답에서 이메일을 함께 뺐다.
- **고친 코드**
  - `backend/.../repository/FriendUserSearchRepository.java` (새 파일) — `searchByNicknamePrefix(escapedPrefix, excludeId, pageable)`
    (`lower(nickname) like lower(prefix%) escape '!'`, 나 제외, 닉네임 순). `UserRepository` 는 다른 영역이라 건드리지 않았다.
  - `backend/.../dto/friend/FriendSearchResultResponse.java` (새 파일) — `userId, nickname, character, relation(FRIEND|OUTGOING|INCOMING|NONE)`.
  - `FriendService` / `FriendServiceImpl.searchByNickname(email, query)` — 2자 미만 400(한국어), 30자로 자름, `% _ !` 를 글자 그대로 찾게 이스케이프, 최대 10명.
  - `FriendController` — `GET /api/friends/search?q=` 추가(경로가 `/api/friends/**` 라 기존 USER/ADMIN 규칙 적용).
  - `FriendRequestCreateRequest` — `targetUserId` 추가, `targetEmail` 은 선택(둘 다 없으면 400 "친구 요청을 보낼 상대를 골라 주세요.").
    `FriendServiceImpl.sendRequest` 가 id 우선으로 찾는다.
  - `FriendRequestResponse` — `requesterEmail/receiverEmail` → `requesterId/receiverId`. `FriendSummaryResponse` — `email` 삭제.
    `requireUser` 의 `"User not found"` → `"로그인이 필요해요."`.
    ```diff
    - private String requesterEmail;
    + private Long requesterId;
    ```
  - `frontend/src/services/friendApi.ts` — `search(q)`, `sendRequestToUser(id)` 추가. 이메일 없는 응답 타입 `FriendRequestView`, `FriendSummaryView`,
    `FriendSearchResult` 를 여기서 정의(`types/friend.ts` 는 이 영역 파일이 아니라 그대로 둠).
  - `frontend/src/pages/Friends.tsx` — "친구 찾기" 칸: 닉네임 2자 이상 입력 후 300ms 멈추면 검색, 결과마다 아바타·닉네임·레벨과
    `요청 보내기 / 요청 보냄 / 받은 요청에서 수락 / 이미 친구` 버튼. 성공 시 토스트. 이메일 표시는 전부 지우고(받은 요청엔 레벨, 보낸 요청엔 "수락을 기다리는 중"),
    연결 상태 줄은 없애고 실시간에 못 붙을 때만 "지금은 새 메시지가 바로 뜨지 않을 수 있어요…" 안내. 오류 문구는 한국어(`apiErrorMessage` → `friendlyError`).
    375px 대비 좌우 여백 `px-4`, 채팅 입력 `min-w-0`, 긴 메시지 `break-words`.
- **확인**: 백엔드 compileJava 통과, 프론트 타입 검사 통과, `Friends.tsx` 린트 7 오류 → 0. 화면은 로그인 필요로 못 봄.
- **남은 것**: `frontend/src/types/friend.ts` 의 `requesterEmail/receiverEmail/email` 필드는 이제 서버가 주지 않는다(쓰는 곳은 이 영역뿐이고 새 타입으로 대체함).
  그 파일 정리는 타입 파일 담당이 하면 된다. 검색 API 는 로그인한 회원이면 닉네임 목록을 10명씩 볼 수 있다(이메일은 안 보임).

### 10. 배포에서 실시간 주소가 없으면 방문자 브라우저가 localhost:4001 로 접속을 시도했다 (항목 40 중 이 영역)

- **원인**: `Home.tsx:61`, `Lounge.tsx:154`, `Friends.tsx:14` 모두 `import.meta.env.VITE_REALTIME_URL ?? "http://localhost:4001"`.
- **고친 코드**
  - `frontend/src/lib/realtime.ts` — `REALTIME_URL = RAW_URL || (import.meta.env.DEV ? "http://localhost:4001" : null)`.
  - `Lounge.tsx` — `REALTIME_URL` 이 `null` 이면 연결하지 않고 "라운지 실시간 기능을 지금은 쓸 수 없어요…" 안내. `Friends.tsx` — 소켓 없이 15초 새로고침.
  - `Home.tsx` — 상수 한 줄만:
    ```diff
    - const REALTIME_URL = import.meta.env.VITE_REALTIME_URL ?? "http://localhost:4001";
    + const REALTIME_URL = import.meta.env.VITE_REALTIME_URL || (import.meta.env.DEV ? "http://localhost:4001" : "");
    ```
    배포에서 비어 있으면 같은 출처 `/status` 로 한 번 요청하고 JSON 이 아니라 실패 → 기존 `catch` 가 인원 수만 숨긴다.
- **남은 것**: `Home.tsx` 는 이 영역이 상수 줄만 맡아서 `lib/realtime.ts` 를 쓰도록 바꾸지 않았다. 홈 담당이 `import { REALTIME_URL } from "../lib/realtime"`
  으로 바꾸고 `null` 일 때 `/status` 요청을 건너뛰면 헛요청 한 번도 없어진다.

---

## 남은 것 (다른 영역 필요)

- `frontend/src/types/friend.ts` — 이메일 필드 제거(위 9번).
- `frontend/src/pages/Home.tsx` — `lib/realtime.ts` 사용 및 `null` 이면 상태 요청 생략(위 10번).
- `SecurityConfig` 변경은 필요 없음(`/api/realtime/ticket` 은 `anyRequest().authenticated()`).
- 로그인이 필요한 화면 확인(라운지 데스크톱/375px, 친구 찾기·1:1 채팅 두 계정)은 사용자가 로그인한 뒤 해야 한다. 그 전에 8080 백엔드 재시작 필요.
