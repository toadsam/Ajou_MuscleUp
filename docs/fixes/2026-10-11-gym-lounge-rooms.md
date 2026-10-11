# 2026-10-11 · 0단계 PR 7 — 라운지 방 나누기: 광장 + 모임 방

설계: [../design/stage0-gyms.md](../design/stage0-gyms.md) §2 "라운지: 실시간 방 `gym:{id}` + 광장 `square` — 입장권(ticket)에 짐 id 를 넣고 서버가 멤버인지 확인".

## 0. 왜
라운지가 방 하나(`lounge`)라, 모임이 늘면 모든 모임 사람이 한 방에 섞이고 "우리 모임끼리" 모일 곳이 없다.

## 1. 원칙 — 방은 입장권에서만
- 클라이언트는 "어느 방에 가고 싶다"고 **백엔드에** 말하고, 백엔드가 멤버인지 확인해 **서명된 입장권**에 방을 넣는다.
- 실시간 서버는 입장권의 `room` 만 믿는다(클라이언트가 소켓으로 보낸 방 이름은 받지 않는다). 형식이 이상하면 광장.
- 그래서 실시간 서버는 DB 를 몰라도 된다(지금 구조 그대로).

## 2. 백엔드 — `RealtimeTicketController`
- `POST /api/realtime/ticket` 본문 `{ "room": "square" | "gym:{slug}" }`(없으면 광장 — 친구 채팅 등 예전 호출 그대로).
- 모임 방: 멤버(앱 운영자 포함) · 운영 중 · 라운지 기능(`GymFeature.LOUNGE`) 켜짐. 아니면 403 / 400, 볼 수 없는 모임은 404.
- 입장권에 `room`("square" | "gym:{id}") · `rname`(방 이름, 40자), 응답에도 `room` · `roomName`.

## 3. 실시간 서버 — `realtime/src`
- `rooms.ts`: 사람마다 방 키를 기억(`roomOfSocket`). `listPlayers(room)` · `takeMovesByRoom()` · `countPlayers(room?)` · `sameRoom(a,b)` · `normalizeRoomKey`(`^(square|gym:\d+)$` 아니면 광장).
- `server.ts`: socket.io 방 이름 `lounge:{room}`. 명단 · 위치 · 채팅 · 입력 중 · 이모트 · 스티커는 그 방에만. **음성**은 같은 방 + 가까운 사람만, **파티 요청**(따라가기 · 순간이동)도 같은 방 사람에게만. 나가면 그 방 명단만 다시 보냄.
- `lounge:welcome` 에 `room` · `roomName`.
- `/status?room=square|gym:{id}` → 그 방 인원. 없으면 전체(예전 응답 모양 그대로).
- `auth.ts` `TicketClaims` 에 `room?` · `rname?`(예전 입장권 = 광장).

## 4. 화면
- `lib/realtime.ts`: `fetchRealtimeTicket(room)`, `realtimeAuthFor(room)` — 모임 방 입장권을 못 받으면(멤버에서 빠짐 · 라운지 끔) **광장으로** 들어간다. 실제 방은 `lounge:welcome` 으로 표시.
- `pages/Lounge.tsx`: 헤더에서 고른 모임이 라운지를 쓰면 그 모임 방이 기본. 제목 아래 "광장 / ○○" 고르기와 "지금 있는 방 · ○○ (모임 멤버만)". 방을 바꾸면 새 입장권으로 다시 붙는다.
- `pages/Home.tsx`: 홈 지도의 라운지 인원 = 고른 모임 방(없으면 광장) 인원.

## 5. 배포 순서 · 호환
어느 쪽이 먼저 배포돼도 깨지지 않는다.
- 새 화면 + 예전 백엔드: 본문을 무시 → 광장 입장권. 새 화면 + 예전 실시간: `?room` 무시 → 전체 인원(= 광장).
- 예전 화면 + 새 서버: 본문 없음 → 광장.

## 6. 확인
- `realtime/bench/room-isolation.mjs`(새, `npm run check:rooms`): 개발 모드 서버에 광장 2명 · 모임 방 2명(잘못된 방 키 1명 포함)을 붙여 9가지 확인 — 명단 · 환영 메시지 · 잘못된 키 → 광장 · 채팅 · 이모트 · 인원 수(전체 4 / 광장 2 / 모임 2) · 나가기. **9개 통과**.
- 백엔드 `RealtimeTicketRoomTest` 2개(광장 기본 · 모임 방은 멤버만 / 라운지 끈 모임 400 / 이상한 방 400 / 없는 모임 404) — 전체 35개 통과.
- `realtime` 빌드(tsc) 통과, `verify.sh` 통과(바꾼 파일 린트 늘어난 것 없음).
- 로컬 홈 화면이 `/status?room=square` 를 부르고 200.

**못 한 것**: 로그인해야 들어가는 라운지 화면에서 방 고르기 · 두 계정으로 방이 나뉘는 모습은 화면으로 못 봤다(서버 동작은 위 스크립트로 확인).

## 7. 알아 둘 것
- `/status?room=gym:{id}` 는 로그인 없이 그 방 **인원 수**만 알려 준다(이름 · 위치는 안 나감). 비공개 모임의 "지금 몇 명" 정도는 보일 수 있다.
- 방마다 지도는 같다(2000×1200). 모임별 지도 테마(`mapTheme`)는 다음 단계.
