import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const requireFromFrontend = createRequire(path.resolve("frontend/package.json"));
const { chromium } = requireFromFrontend("playwright");

const FRONTEND_URL = process.env.MUSCLEUP_FRONTEND_URL || "http://127.0.0.1:5173";
const API_URL = process.env.MUSCLEUP_API_URL || "http://localhost:8080";
const MEMBER_EMAIL = process.env.MUSCLEUP_MEMBER_EMAIL;
const ADMIN_EMAIL = process.env.MUSCLEUP_ADMIN_EMAIL;
const TEST_PASSWORD = process.env.MUSCLEUP_TEST_PASSWORD;
const OUT_DIR = path.resolve("docs/images");

if (!MEMBER_EMAIL || !ADMIN_EMAIL || !TEST_PASSWORD) {
  throw new Error("MUSCLEUP_MEMBER_EMAIL, MUSCLEUP_ADMIN_EMAIL, MUSCLEUP_TEST_PASSWORD are required.");
}

const today = new Date();
const toDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const addDays = (base, delta) => {
  const next = new Date(base);
  next.setDate(next.getDate() + delta);
  return next;
};

async function apiJson(request, pathName, options = {}) {
  const response = await request.fetch(`${API_URL}${pathName}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok()) {
    const text = await response.text().catch(() => "");
    throw new Error(`${options.method || "GET"} ${pathName} failed: ${response.status()} ${text}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function login(context, email) {
  const response = await context.request.post(`${API_URL}/api/auth/login`, {
    data: { email, password: TEST_PASSWORD, rememberMe: true },
  });
  if (!response.ok()) {
    throw new Error(`login failed for ${email}: ${response.status()} ${await response.text()}`);
  }
  const session = await response.json();
  await context.addInitScript((user) => {
    window.localStorage.setItem("user", JSON.stringify(user));
  }, {
    accessToken: session.token,
    refreshToken: session.refreshToken,
    email: session.email,
    nickname: session.nickname,
    role: session.role,
  });
  return session;
}

async function suppressBetaNotice(context) {
  await context.addInitScript(() => {
    window.localStorage.setItem("beta_notice_hide_until", String(Date.now() + 7 * 24 * 60 * 60 * 1000));
  });
}

async function seedMemberData(context) {
  const request = context.request;

  await apiJson(request, "/api/mypage/stats", {
    method: "PUT",
    data: {
      heightCm: 174,
      gender: "MALE",
      weightKg: 73,
      skeletalMuscleKg: 35.2,
      bodyFatPercent: 17.4,
      mbti: "ENTJ",
      benchKg: 82.5,
      squatKg: 120,
      deadliftKg: 145,
    },
  });

  for (let i = -5; i <= 0; i += 1) {
    const date = toDateKey(addDays(today, i));
    await apiJson(request, `/api/attendance/${date}`, {
      method: "PUT",
      data: {
        didWorkout: i !== -2,
        memo: i === 0 ? "문서 캡처용 테스트 운동 기록입니다. 상체 루틴과 유산소를 완료했습니다." : "테스트 운동 기록",
        shareComment: i === 0 ? "오늘 운동 완료" : null,
        workoutTypes: i === -2 ? [] : ["weight", "cardio"],
        workoutIntensity: i === -2 ? null : "normal",
        mediaUrls: [],
      },
    });
  }

  await apiJson(request, `/api/attendance/${toDateKey(today)}/share`, { method: "POST" }).catch(() => null);

  await apiJson(request, "/api/brags", {
    method: "POST",
    data: {
      title: "문서 캡처용 벤치프레스 PR",
      content: "벤치프레스 기록을 갱신한 테스트 게시글입니다. 발표 문서 캡처용 더미 데이터입니다.",
      mediaUrls: [],
      movement: "벤치프레스",
      weight: "82.5kg",
      visibility: "PUBLIC",
    },
  }).catch(() => null);

  const protein = await apiJson(request, "/api/proteins", {
    method: "POST",
    data: {
      name: "테스트 웨이 프로틴",
      price: 58000,
      days: 7,
      goal: 8,
      imageUrl: "https://placehold.co/600x400/png?text=Protein",
      description: "문서 캡처용 공동구매 모집 데이터입니다.",
      category: "웨이",
    },
  }).catch(() => null);

  const proteinId = protein?.id;
  if (proteinId) {
    await apiJson(request, `/api/proteins/${proteinId}/applications`, { method: "POST", data: {} }).catch(() => null);
    await apiJson(request, "/api/reviews", {
      method: "POST",
      data: { proteinId, rating: 5, content: "맛과 용해도를 확인하는 캡처용 테스트 리뷰입니다." },
    }).catch(() => null);
  }

  const crew = await apiJson(request, "/api/crew/groups", {
    method: "POST",
    data: {
      name: "문서 캡처 운동 모임",
      description: "출석과 챌린지 흐름을 보여주기 위한 테스트 모임입니다.",
      joinPolicy: "AUTO_APPROVE",
    },
  }).catch(() => null);

  if (crew?.id) {
    await apiJson(request, `/api/crew/groups/${crew.id}/challenges`, {
      method: "POST",
      data: {
        title: "주 3회 출석 챌린지",
        description: "문서 캡처용 챌린지입니다.",
        startDate: toDateKey(addDays(today, -1)),
        endDate: toDateKey(addDays(today, 14)),
        targetWorkoutDays: 3,
      },
    }).catch(() => null);
  }

  await apiJson(request, "/api/programs/apply", {
    method: "POST",
    data: {
      name: "문서회원",
      email: "masked@example.test",
      goal: "문서 캡처용 반 추천 신청",
      track: "성장반",
      commitment: "주 3회 참여 가능",
    },
  }).catch(() => null);

  await apiJson(request, "/api/support/inquiries", {
    method: "POST",
    data: {
      name: "문서회원",
      email: "masked@example.test",
      message: "문서 캡처용 문의입니다.",
      page: "/docs-capture",
    },
  }).catch(() => null);
}

async function seedAdminData(context) {
  const start = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const end = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  await apiJson(context.request, "/api/admin/events", {
    method: "POST",
    data: {
      title: "문서 캡처용 출석 이벤트",
      summary: "운동 출석과 커뮤니티 참여를 함께 보여주는 테스트 이벤트입니다.",
      content: "발표 문서 화면 캡처를 위한 더미 이벤트입니다.",
      thumbnailUrl: "https://placehold.co/900x500/png?text=MuscleUp+Event",
      bannerUrl: "https://placehold.co/1200x420/png?text=MuscleUp+Banner",
      startAt: start.toISOString().slice(0, 19),
      endAt: end.toISOString().slice(0, 19),
      status: "ACTIVE",
      isMainBanner: true,
      isPinned: true,
      priority: 10,
      ctaText: "자세히 보기",
      ctaLink: "/events",
      tags: ["출석", "커뮤니티", "테스트"],
    },
  }).catch(() => null);
}

async function maskSensitiveText(page) {
  await page.evaluate((values) => {
    const exactValues = new Set(values.filter(Boolean));
    const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      let text = node.nodeValue || "";
      exactValues.forEach((value) => {
        text = text.split(value).join("테스트 계정");
      });
      text = text.replace(emailRegex, "테스트 계정");
      node.nodeValue = text;
    });
    document.querySelectorAll("input, textarea").forEach((el) => {
      if ("value" in el && typeof el.value === "string") {
        el.value = el.value.replace(emailRegex, "테스트 계정");
      }
      ["placeholder", "title", "aria-label"].forEach((attr) => {
        const value = el.getAttribute(attr);
        if (value) el.setAttribute(attr, value.replace(emailRegex, "테스트 계정"));
      });
    });
  }, [MEMBER_EMAIL, ADMIN_EMAIL]);
}

async function shot(page, urlPath, fileName, options = {}) {
  await page.goto(`${FRONTEND_URL}${urlPath}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(options.delayMs ?? 1400);
  if (options.scrollY) {
    await page.evaluate((y) => window.scrollTo(0, y), options.scrollY);
    await page.waitForTimeout(350);
  }
  if (options.fill) {
    await options.fill(page);
    await page.waitForTimeout(350);
  }
  await maskSensitiveText(page);
  await page.screenshot({ path: path.join(OUT_DIR, fileName), fullPage: false });
  return { fileName, url: `${FRONTEND_URL}${urlPath}` };
}

await fs.mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const captured = [];

try {
  const guestContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await suppressBetaNotice(guestContext);
  const guestPage = await guestContext.newPage();
  captured.push(await shot(guestPage, "/", "home.png"));
  captured.push(await shot(guestPage, "/login", "login.png"));
  captured.push(await shot(guestPage, "/register", "signup.png"));
  captured.push(await shot(guestPage, "/programs", "programs.png", { scrollY: 520 }));
  await guestContext.close();

  const memberContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await suppressBetaNotice(memberContext);
  await login(memberContext, MEMBER_EMAIL);
  await seedMemberData(memberContext);
  const memberPage = await memberContext.newPage();
  captured.push(await shot(memberPage, "/", "member-home.png"));
  captured.push(await shot(memberPage, "/attendance", "attendance.png"));
  captured.push(await shot(memberPage, "/mypage", "mypage.png"));
  captured.push(await shot(memberPage, "/rankings", "rankings.png"));
  captured.push(await shot(memberPage, "/brag", "brag-list.png"));
  captured.push(await shot(memberPage, "/brag/write", "brag-write.png"));
  captured.push(await shot(memberPage, "/protein", "protein-list.png"));
  captured.push(await shot(memberPage, "/reviews", "reviews.png"));
  captured.push(await shot(memberPage, "/ai", "ai-fitness.png"));
  captured.push(await shot(memberPage, "/ai/inbody", "inbody-consult.png"));
  captured.push(await shot(memberPage, "/crew", "crew-hub.png"));
  captured.push(await shot(memberPage, "/friends", "friends.png"));
  captured.push(await shot(memberPage, "/lounge", "lounge.png"));
  captured.push(await shot(memberPage, "/events", "events.png"));
  await memberContext.close();

  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await suppressBetaNotice(adminContext);
  await login(adminContext, ADMIN_EMAIL);
  await seedAdminData(adminContext);
  const adminPage = await adminContext.newPage();
  captured.push(await shot(adminPage, "/admin", "admin-dashboard.png"));
  captured.push(await shot(adminPage, "/admin/events", "admin-events.png"));
  captured.push(await shot(adminPage, "/admin/history", "admin-history.png"));
  await adminContext.close();
} finally {
  await browser.close();
}

await fs.writeFile(
  path.join(OUT_DIR, "capture-manifest.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), captured }, null, 2),
  "utf8",
);

console.log(JSON.stringify(captured, null, 2));
