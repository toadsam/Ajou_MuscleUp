import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { logEvent } from "../utils/analytics";
import { useCountUp } from "../hooks/useCountUp";
import { useInView } from "../hooks/useInView";

// 소개 화면. 지어낸 숫자·가짜 피드 없이, 실제로 있는 기능과 공개 지표(GET /api/metrics/lobby)만 보여 준다.

type LobbyMetrics = {
  loungeVisitCount: number;
  todayAttendanceCount: number;
  totalThreeLiftKg: number;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

function StatNumber({ value, start }: { value: number; start: boolean }) {
  const v = useCountUp(value, { duration: 1000, start });
  return <>{Math.round(v).toLocaleString("ko-KR")}</>;
}

function hasLocalUser(): boolean {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return false;
    const user = JSON.parse(raw) as { email?: string; accessToken?: string };
    return Boolean(user?.email || user?.accessToken);
  } catch {
    return false;
  }
}

// 핵심 루프: 출석 → 캐릭터 → 라운지
const LOOP = [
  {
    title: "출석 체크",
    desc: "운동한 날 사진과 함께 출석을 남겨요. 연속 출석이 쌓이고, 공유 카드로 저장할 수도 있어요.",
    to: "/attendance",
    plate: "bg-plate-red",
  },
  {
    title: "캐릭터 성장",
    desc: "출석과 기록이 쌓일수록 내 픽셀 리프터가 자라고 티어가 올라가요.",
    to: "/mypage",
    plate: "bg-plate-yellow",
  },
  {
    title: "라운지",
    desc: "다른 회원의 캐릭터와 같은 공간에 모여 이야기해요. 랭킹에서 서로의 기록도 볼 수 있어요.",
    to: "/lounge",
    plate: "bg-plate-blue",
  },
] as const;

const MORE = [
  { title: "운동 모임", desc: "같이 운동할 사람끼리 모임을 만들고 챌린지에 함께 도전해요.", to: "/crew" },
  { title: "자랑방", desc: "운동 사진과 기록을 올리고 응원을 주고받아요.", to: "/brag" },
  { title: "공동구매", desc: "단백질 보충제 공동구매를 열거나 참여하고, 후기를 나눠요.", to: "/protein" },
  { title: "AI 플래너", desc: "목표와 상황을 적으면 AI 가 운동 루틴을 짜 줘요.", to: "/ai" },
] as const;

export default function About() {
  const [metrics, setMetrics] = useState<LobbyMetrics | null>(null);
  const [metricsFailed, setMetricsFailed] = useState(false);
  const [loggedIn] = useState(hasLocalUser);
  const [statsRef, statsInView] = useInView<HTMLDivElement>();

  useEffect(() => {
    logEvent("about", "page_view");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/metrics/lobby`, { credentials: "omit" });
        if (!res.ok) throw new Error("metrics");
        const data = (await res.json()) as LobbyMetrics;
        if (!cancelled) setMetrics(data);
      } catch {
        if (!cancelled) setMetricsFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startTo = loggedIn ? "/attendance" : "/login?next=%2Fattendance";
  const startLabel = loggedIn ? "출석하러 가기" : "Google로 시작하기";

  const stats = [
    { label: "오늘 출석", value: metrics?.todayAttendanceCount, unit: "명" },
    { label: "라운지 누적 입장", value: metrics?.loungeVisitCount, unit: "회" },
    { label: "누적 3대 합계", value: metrics?.totalThreeLiftKg, unit: "kg" },
  ];

  return (
    <section className="relative overflow-hidden text-white">
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-16 px-6 pb-24 pt-28 lg:px-10">
        {/* 첫 화면 */}
        <header className="grid items-center gap-10 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="dg-rise space-y-6">
            <p className="font-num text-base font-bold text-plate-red">Ajou MuscleUp</p>
            <h1 className="break-keep text-4xl leading-tight md:text-5xl lg:text-6xl">
              출석하면 <span className="text-plate-yellow">캐릭터가 자라고</span>, 라운지에서 함께 운동해요.
            </h1>
            <p className="break-keep text-lg leading-relaxed text-steel-300">
              득근득근은 아주대 헬스 동아리의 커뮤니티예요. 운동한 날을 출석으로 남기면 내 캐릭터가 성장하고,
              라운지와 운동 모임에서 다른 회원과 이어져요.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to={startTo} className="dg-btn dg-btn-primary px-6 text-sm">
                {startLabel}
              </Link>
              <Link to="/lounge" className="dg-btn dg-btn-steel px-6 text-sm">
                라운지 둘러보기
              </Link>
            </div>
          </div>

          {/* 실제 공개 지표. 못 불러오면 숫자 대신 안내만 보인다 */}
          <div className="dg-steel dg-rise p-6" style={{ animationDelay: "120ms" }}>
            <p className="text-sm font-semibold text-steel-300">지금 득근득근</p>
            <div ref={statsRef} className="mt-4 grid grid-cols-3 gap-3 text-center">
              {stats.map((stat) => (
                <div key={stat.label} className="dg-well px-2 py-4">
                  <p className="font-num text-3xl font-black text-plate-yellow sm:text-4xl">
                    {typeof stat.value === "number" ? <StatNumber value={stat.value} start={statsInView} /> : "-"}
                    <span className="ml-0.5 text-base text-steel-300">{stat.unit}</span>
                  </p>
                  <p className="mt-1 break-keep text-xs text-steel-400">{stat.label}</p>
                </div>
              ))}
            </div>
            {metricsFailed && (
              <p className="mt-3 text-xs text-steel-400">지금은 숫자를 불러오지 못했어요. 잠시 뒤에 다시 보여 드릴게요.</p>
            )}
          </div>
        </header>

        {/* 핵심 루프 */}
        <section className="dg-whiteboard p-6">
          <div className="mb-4">
            <p className="font-num text-sm font-bold text-board-blue">How it works</p>
            <h2 className="font-pen text-4xl leading-none">득근득근 한 바퀴</h2>
          </div>
          <ol className="grid gap-3 text-sm md:grid-cols-3">
            {LOOP.map((step, idx) => (
              <li key={step.title} className="dg-rise" style={{ animationDelay: `${idx * 60}ms` }}>
                <Link
                  to={step.to}
                  className="flex h-full flex-col rounded-md border-2 border-dashed border-board-frame p-4 transition hover:border-board-ink"
                >
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className={`h-6 w-2.5 rounded-sm border-2 border-black ${step.plate}`} />
                    <span className="font-num text-sm font-bold text-board-red">Step {idx + 1}</span>
                  </span>
                  <span className="mt-2 text-lg font-bold">{step.title}</span>
                  <span className="mt-1 break-keep opacity-80">{step.desc}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        {/* 함께 쓰는 기능 */}
        <section className="space-y-4">
          <h2 className="font-display text-2xl md:text-3xl">같이 쓰면 더 좋은 기능</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MORE.map((item, idx) => (
              <Link
                key={item.title}
                to={item.to}
                className="dg-steel dg-lift dg-rise block p-5"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <h3 className="font-display text-xl">{item.title}</h3>
                <p className="mt-2 break-keep text-sm leading-relaxed text-steel-300">{item.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* 마무리 */}
        <section className="relative overflow-hidden rounded-lg border-[3px] border-black bg-plate-red p-8 shadow-xl">
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="break-keep font-display text-2xl text-white md:text-3xl">오늘 운동했다면, 출석부터 남겨 보세요.</h3>
              <p className="mt-2 break-keep text-sm text-white/85">
                Google 계정으로 로그인하면 따로 가입 절차 없이 바로 시작할 수 있어요.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to={startTo} className="dg-btn dg-chalk-burst bg-chalk px-5 text-sm text-black">
                {startLabel}
              </Link>
              <Link to="/executives" className="dg-btn dg-btn-steel px-5 text-sm">
                운영진 소개
              </Link>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
