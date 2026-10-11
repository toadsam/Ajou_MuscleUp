/**
 * 라운지 방 나누기 확인(0단계 PR 7). 광장 · 모임 방 사람이 서로의 명단 · 채팅 · 이모트를 받지 않는지 본다.
 *
 * 쓰는 법(개발 모드 서버 — REALTIME_TICKET_SECRET 없이, NODE_ENV 가 production 아님):
 *   cd realtime && npm run build && PORT=4011 node dist/server.js     (다른 터미널)
 *   node bench/room-isolation.mjs --url http://localhost:4011
 *
 * 입장권은 개발용 비밀값(src/auth.ts 의 DEV_SECRET)으로 여기서 직접 서명한다 — 백엔드가 만드는 것과 같은 모양.
 * 실패하면 종료 코드 1.
 */
import { io } from "socket.io-client";
import { createHmac } from "node:crypto";

const arg = (name, fallback) => {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const URL = arg("url", "http://localhost:4011");
const DEV_SECRET = "muscleup-dev-only-realtime-ticket-secret";

const b64 = (buf) => Buffer.from(buf).toString("base64url");
const ticket = (uid, nick, room, rname) => {
  const now = Math.floor(Date.now() / 1000);
  const body = b64(JSON.stringify({
    v: 1, uid, pid: "p" + uid.toString(16).padStart(16, "0"), nick, lv: 1, tier: "BRONZE", stage: 0,
    gender: null, seed: null, style: null, rest: false, gp: null, fr: [], room, rname, iat: now, exp: now + 120,
  }));
  return body + "." + b64(createHmac("sha256", DEV_SECRET).update(body, "ascii").digest());
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok) => { results.push({ name, ok }); console.log(`${ok ? "OK  " : "FAIL"} ${name}`); };

const connect = (uid, nick, room, rname) => new Promise((resolve, reject) => {
  const s = io(URL, { transports: ["websocket"], auth: { ticket: ticket(uid, nick, room, rname) }, forceNew: true });
  const state = { s, players: [], chats: [], emotes: [], welcome: null };
  s.on("lounge:players", (p) => { state.players = p.players.map((x) => x.nickname); });
  s.on("chat:message", (m) => state.chats.push(m.message));
  s.on("social:emote", (m) => state.emotes.push(m.nickname));
  s.on("lounge:welcome", (w) => { state.welcome = w; });
  s.on("connect", () => { s.emit("lounge:join", {}); resolve(state); });
  s.on("connect_error", reject);
});

const square = await connect(1, "광장A", "square", "광장");
const gymB = await connect(2, "모임B", "gym:7", "테스트 모임");
const gymC = await connect(3, "모임C", "gym:7", "테스트 모임");
const forged = await connect(4, "엉뚱D", "gym:../../x", "가짜"); // 잘못된 방 키 → 광장
await wait(400);

check("광장 사람은 광장 사람만 본다", JSON.stringify(square.players.sort()) === JSON.stringify(["광장A", "엉뚱D"].sort()));
check("모임 방 사람은 같은 방 사람만 본다", JSON.stringify(gymB.players.sort()) === JSON.stringify(["모임B", "모임C"].sort()));
check("환영 메시지에 방 이름", gymB.welcome?.room === "gym:7" && gymB.welcome?.roomName === "테스트 모임" && square.welcome?.room === "square");
check("잘못된 방 키는 광장으로", forged.welcome?.room === "square");

gymB.s.emit("chat:send", { message: "모임 비밀 이야기" });
square.s.emit("chat:send", { message: "광장 인사" });
gymC.s.emit("social:emote", { emote: "wave" });
await wait(400);
check("모임 채팅은 같은 방에만", gymC.chats.includes("모임 비밀 이야기") && !square.chats.includes("모임 비밀 이야기") && !forged.chats.includes("모임 비밀 이야기"));
check("광장 채팅은 모임 방에 안 감", square.chats.includes("광장 인사") && !gymB.chats.includes("광장 인사"));
check("이모트도 같은 방에만", gymB.emotes.includes("모임C") && !square.emotes.includes("모임C"));

const status = async (q) => (await (await fetch(`${URL}/status${q}`)).json()).activePlayers;
check("인원 수: 전체 4 · 광장 2 · 모임 2", (await status("")) === 4 && (await status("?room=square")) === 2 && (await status("?room=gym:7")) === 2);

gymC.s.disconnect();
await wait(300);
check("나가면 같은 방 명단만 바뀜", JSON.stringify(gymB.players) === JSON.stringify(["모임B"]) && square.players.length === 2);

for (const st of [square, gymB, forged]) st.s.disconnect();
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed}개 실패` : `\n모두 통과 (${results.length}개)`);
process.exit(failed ? 1 : 0);
