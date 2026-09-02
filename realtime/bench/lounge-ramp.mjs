/**
 * 라운지 실시간 서버 동시접속 램프.
 *
 * 왜 있나: 이 프로젝트의 가설은 두 문장이었다 — "실시간 상태를 Socket.IO 서버로
 * 분리하면 다시 오는 이유가 생기면서 **서버도 감당 가능하다**". 뒤 절반을 재려고
 * 만든 스크립트다. 포트폴리오에 실린 램프 표가 이 스크립트의 출력이다.
 *
 * 새 측정 도구를 만들지 않았다 — 앱이 이미 가진 ping:check / ping:result 왕복을
 * (server.ts:307) 그대로 쓴다. 클라이언트가 보내는 것도 실제 화면과 같은
 * lounge:join + player:move 다.
 *
 * 재는 것
 *   p50 / p95      ping:check 왕복 시간
 *   브로드캐스트/s   서버가 lounge:players 를 실제로 뿌린 횟수
 *                  (설계값은 60ms 주기 = 16.7Hz. server.ts 의 setInterval(..., 60))
 *   1인 수신        한 클라이언트가 초당 받는 바이트
 *   서버 송신       1인 수신 × 접속 수 (팬아웃 총량)
 *   1인당 바이트     lounge:players 한 번의 크기 ÷ 그 안의 플레이어 수
 *
 * CPU/RSS 는 클라이언트가 알 수 없다. --pid 를 주면 서버 프로세스를 샘플링하고,
 * 못 읽으면 "-" 로 남긴다. 없는 값을 지어내지 않는다.
 *
 * 쓰는 법
 *   cd realtime
 *   npm install
 *   npm run dev                     (다른 터미널에서 서버를 띄워 둔다)
 *   node bench/lounge-ramp.mjs
 *   node bench/lounge-ramp.mjs --steps 25,50,100 --seconds 16 --repeats 3 --pid 12345
 *
 * 주의: 한 대에서 클라이언트와 서버를 같이 돌리면 네트워크가 빠지고(루프백),
 * 클라이언트 자신이 CPU 를 먹는다. 그 조건을 결과에 반드시 함께 적는다.
 */

import { io } from "socket.io-client";
import { execFile } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// ── 인자 ────────────────────────────────────────────────────────────────────
const arg = (name, fallback) => {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const URL = arg("url", process.env.REALTIME_URL ?? "http://localhost:4001");
const STEPS = arg("steps", "25,50,100,150,200,300").split(",").map(Number);
const SECONDS = Number(arg("seconds", "16"));
const REPEATS = Number(arg("repeats", "3"));
const SERVER_PID = arg("pid", "");
const OUT = arg("out", "bench/results/lounge-ramp.csv");

// ── 실제 화면이 보내는 것과 같은 모양의 join 페이로드 ───────────────────────
// growthParams 19개를 반드시 채운다. 페이로드가 커지는 주된 이유가 이것이고,
// 비워 두고 재면 실제보다 좋게 나온다. (types.ts 의 GrowthParams 와 같은 필드)
const TIERS = ["BRONZE", "SILVER", "GOLD"];

const growthParams = () => ({
  bmiNormalized: 0.51,
  muscularityNormalized: 0.62,
  fatNormalized: 0.33,
  armGrowth: 0.44,
  legGrowth: 0.48,
  torsoGrowth: 0.41,
  armScale: 1.06,
  legScale: 1.04,
  torsoScaleX: 1.02,
  chestGrowth: 0.47,
  backGrowth: 0.45,
  shoulderGrowth: 0.49,
  quadGrowth: 0.52,
  hamstringGrowth: 0.43,
  gluteGrowth: 0.46,
  strokeWidth: 2.4,
  muscleDetailOpacity: 0.72,
  fatShadowOpacity: 0.18,
  contrastBoost: 1.12
});

const joinPayload = (i) => ({
  userId: "bench-" + i,
  nickname: "bench" + i,
  level: 20 + (i % 60),
  tier: TIERS[i % TIERS.length],
  evolutionStage: i % 9,
  gender: i % 2 === 0 ? "MALE" : "FEMALE",
  avatarSeed: "seed-" + i,
  stylePreset: "default",
  mbti: "ENFP",
  isResting: false,
  growthParams: growthParams(),
  recentAttendanceCount: i % 30,
  activeEventTitle: "벤치마크",
  activeEventProgress: "3/7"
});

// rooms.ts 의 MAP_WIDTH / MAP_HEIGHT 와 같은 값
const MAP = { width: 2000, height: 1200 };

const percentile = (sorted, p) =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : NaN;

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return NaN;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ── 서버 프로세스 CPU/RSS (선택) ────────────────────────────────────────────
async function sampleProcess(pid) {
  if (!pid) return null;
  try {
    if (process.platform === "win32") {
      const { stdout } = await execFileAsync("powershell", [
        "-NoProfile",
        "-Command",
        "$p = Get-Process -Id " + pid + " -ErrorAction Stop; $p.CPU; $p.WorkingSet64"
      ]);
      const [cpuSec, rss] = stdout.trim().split(/\s+/).map(Number);
      return { cpuSec, rss };
    }
    const { stdout } = await execFileAsync("ps", ["-o", "time=,rss=", "-p", String(pid)]);
    const parts = stdout.trim().split(/\s+/);
    const hms = parts[0].split(":").map(Number);
    const cpuSec =
      hms.length === 3 ? hms[0] * 3600 + hms[1] * 60 + hms[2] : hms[0] * 60 + hms[1];
    return { cpuSec, rss: Number(parts[1]) * 1024 };
  } catch {
    return null; // 못 읽으면 비워 둔다
  }
}

// ── 한 단계 ─────────────────────────────────────────────────────────────────
async function runStep(count) {
  const sockets = [];
  const rtts = [];
  let broadcasts = 0;
  let bytes = 0;
  let playersSeen = 0;
  let playerBytes = 0;

  await new Promise((resolve, reject) => {
    let ready = 0;
    let failed = 0;
    for (let i = 0; i < count; i++) {
      const s = io(URL, { transports: ["websocket"], reconnection: false });
      sockets.push(s);

      s.on("connect", () => {
        s.emit("lounge:join", joinPayload(i));
        ready += 1;
        if (ready === count) resolve();
      });

      s.on("connect_error", (e) => {
        failed += 1;
        if (failed === 1) reject(new Error("접속 실패: " + e.message));
      });

      // 수신량은 **첫 소켓에서만** 잰다. 300개 전부에서 JSON 크기를 재면
      // 클라이언트 CPU 가 병목이 되어 측정 자체를 망친다.
      if (i === 0) {
        s.on("lounge:players", (payload) => {
          broadcasts += 1;
          const size = Buffer.byteLength(JSON.stringify(payload));
          bytes += size;
          const n = payload && payload.players ? payload.players.length : 0;
          if (n > 0) {
            playersSeen += n;
            playerBytes += size;
          }
        });
      }

      s.on("ping:result", (res) => {
        if (res && Number.isFinite(res.clientTs)) rtts.push(Date.now() - res.clientTs);
      });
    }
  });

  const before = await sampleProcess(SERVER_PID);
  const t0 = Date.now();

  // 실제 화면처럼 움직이고, 그와 별개로 왕복을 잰다.
  const moveTimer = setInterval(() => {
    for (const s of sockets) {
      s.emit("player:move", {
        x: Math.random() * (MAP.width - 80) + 40,
        y: Math.random() * (MAP.height - 80) + 40
      });
    }
  }, 200);

  const pingTimer = setInterval(() => {
    for (const s of sockets) s.emit("ping:check", { clientTs: Date.now() });
  }, 500);

  await new Promise((r) => setTimeout(r, SECONDS * 1000));
  clearInterval(moveTimer);
  clearInterval(pingTimer);

  const elapsed = (Date.now() - t0) / 1000;
  const after = await sampleProcess(SERVER_PID);
  for (const s of sockets) s.close();
  await new Promise((r) => setTimeout(r, 600)); // 서버가 정리할 시간

  const sorted = [...rtts].sort((a, b) => a - b);
  const perClientBps = bytes / elapsed;
  const cpuPct =
    before && after && elapsed > 0 ? ((after.cpuSec - before.cpuSec) / elapsed) * 100 : null;

  return {
    count,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    samples: sorted.length,
    broadcastsPerSec: broadcasts / elapsed,
    perClientKBs: perClientBps / 1024,
    serverMBs: (perClientBps * count) / (1024 * 1024),
    bytesPerPlayer: playersSeen ? playerBytes / playersSeen : NaN,
    cpuPct,
    rssMB: after ? after.rss / (1024 * 1024) : null
  };
}

// ── 실행 ────────────────────────────────────────────────────────────────────
console.log("대상 " + URL + " · 단계 " + STEPS.join(",") + " · " + SECONDS + "초 × " + REPEATS + "회");
console.log(SERVER_PID ? "서버 PID " + SERVER_PID + " 샘플링" : "CPU/RSS 는 재지 않음 (--pid 로 지정)");
console.log("");

const rows = [];
for (const count of STEPS) {
  const reps = [];
  for (let r = 0; r < REPEATS; r += 1) {
    process.stdout.write("  " + String(count).padStart(3) + "명 " + (r + 1) + "/" + REPEATS + " … ");
    const res = await runStep(count);
    reps.push(res);
    console.log("p50 " + res.p50 + "ms p95 " + res.p95 + "ms (" + res.samples + " 표본)");
    await new Promise((done) => setTimeout(done, 1500)); // 단계 사이 회복
  }
  const pick = (k) =>
    median(reps.map((x) => x[k]).filter((v) => v != null && !Number.isNaN(v)));
  rows.push({
    count,
    p50: pick("p50"),
    p95: pick("p95"),
    broadcastsPerSec: pick("broadcastsPerSec"),
    serverMBs: pick("serverMBs"),
    perClientKBs: pick("perClientKBs"),
    bytesPerPlayer: pick("bytesPerPlayer"),
    cpuPct: reps.some((x) => x.cpuPct != null) ? pick("cpuPct") : null,
    rssMB: reps.some((x) => x.rssMB != null) ? pick("rssMB") : null
  });
}

const f1 = (v) => (v == null || Number.isNaN(v) ? "-" : v.toFixed(1));

console.log("");
console.log("// 명    p50      p95  브로드캐스트/s   서버송신    1인수신    1인당B     CPU      RSS");
for (const r of rows) {
  console.log(
    "  " +
      String(r.count).padStart(3) +
      f1(r.p50).padStart(7) + "ms" +
      f1(r.p95).padStart(7) + "ms" +
      f1(r.broadcastsPerSec).padStart(13) +
      (f1(r.serverMBs) + "MB/s").padStart(11) +
      (f1(r.perClientKBs) + "KB/s").padStart(11) +
      f1(r.bytesPerPlayer).padStart(10) +
      (f1(r.cpuPct) + "%").padStart(9) +
      (f1(r.rssMB) + "MB").padStart(10)
  );
}

mkdirSync("bench/results", { recursive: true });
const csv = [
  "clients,p50_ms,p95_ms,broadcasts_per_sec,server_mb_s,per_client_kb_s,bytes_per_player,cpu_pct,rss_mb",
  ...rows.map((r) =>
    [
      r.count,
      r.p50,
      r.p95,
      r.broadcastsPerSec,
      r.serverMBs,
      r.perClientKBs,
      r.bytesPerPlayer,
      r.cpuPct == null ? "" : r.cpuPct,
      r.rssMB == null ? "" : r.rssMB
    ]
      .map((v) => (typeof v === "number" ? Number(v.toFixed(3)) : v))
      .join(",")
  )
].join("\n");
writeFileSync(OUT, csv + "\n");

console.log("");
console.log("저장: " + OUT);
console.log("조건: " + SECONDS + "초 × " + REPEATS + "회 중앙값 · " + URL);
console.log("루프백에서 재면 네트워크가 빠진다 — 결과를 옮길 때 조건을 함께 적을 것.");
