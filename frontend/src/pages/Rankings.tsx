import { useEffect, useState, type CSSProperties } from "react";
import { useCountUp } from "../hooks/useCountUp";
import { toast } from "../lib/toast";
import { friendlyError, httpError } from "../lib/httpError";

type RankingItem = {
  nickname: string;
  level: number;
  tier: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND" | "MASTER" | "GRANDMASTER" | "CHALLENGER";
  evolutionStage: number;
  title: string;
  threeLiftTotal?: number | null;
  updatedAt?: string | null;
  // 서버가 붙여 주는 값: 3대 중량은 본인이 입력한 기록이다
  selfReported?: boolean | null;
};

type RankingResponse = {
  items: RankingItem[];
  totalPublic: number;
  myRank: number | null;
  myTopPercent: number | null;
};

// GET /api/gyms/mine 에서 쓰는 값만
type MyGym = {
  slug: string;
  name: string;
  status?: string;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

// 범위 버튼용 내 모임(운영 중인 곳만). 실패하거나 로그인 전이면 빈 목록 → "전체"만 보인다
async function fetchMyActiveGyms(): Promise<MyGym[]> {
  try {
    const url = API_BASE ? `${API_BASE}/api/gyms/mine` : "/api/gyms/mine";
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return [];
    const list = (await res.json()) as MyGym[];
    return Array.isArray(list) ? list.filter((g) => g.status === "ACTIVE") : [];
  } catch {
    return [];
  }
}

async function api<T>(path: string): Promise<T> {
  const url = API_BASE ? `${API_BASE}${path}` : path;
  const res = await fetch(url, { credentials: "include" });
  if (res.status === 401) {
    toast("로그인이 필요해요. 로그인 화면으로 이동할게요.", "error");
    window.location.href = "/login";
    throw new Error("로그인이 필요해요.");
  }
  if (!res.ok) {
    throw await httpError(res, "랭킹을 불러오지 못했어요.");
  }
  return res.json();
}

// 1~3위 메달: 정면에서 본 원판(노랑 · 회색 · 빨강). 가운데 구멍이 바벨 슬리브 자리.
const MEDAL_PLATES = [
  { bg: "bg-plate-yellow", ink: "text-black" },
  { bg: "bg-steel-300", ink: "text-black" },
  { bg: "bg-plate-red", ink: "text-white" },
];

function PlateMedal({ rank }: { rank: number }) {
  const plate = MEDAL_PLATES[rank - 1];
  return (
    <span
      className={`dg-plate-in relative grid h-14 w-14 flex-none place-items-center rounded-full border-[3px] border-black shadow-md ${plate.bg}`}
      style={{ "--from": "-40px" } as CSSProperties}
      aria-label={`${rank}위`}
    >
      <span className="absolute inset-[7px] rounded-full border-2 border-black/40" aria-hidden />
      <span className={`font-num relative text-2xl font-black leading-none ${plate.ink}`}>{rank}</span>
      <span className="absolute bottom-[5px] h-1.5 w-1.5 rounded-full bg-black" aria-hidden />
    </span>
  );
}

function CountNumber({ value, className = "" }: { value: number; className?: string }) {
  const v = useCountUp(value, { duration: 900 });
  const digits = Number.isInteger(value) ? 0 : Math.min(2, String(value).split(".")[1]?.length ?? 0);
  return <span className={className}>{v.toFixed(digits)}</span>;
}

const TABS: { key: "LEVEL" | "THREE_LIFT"; label: string }[] = [
  { key: "LEVEL", label: "레벨" },
  { key: "THREE_LIFT", label: "3대 중량" },
];

export default function Rankings() {
  const [type, setType] = useState<"LEVEL" | "THREE_LIFT">("LEVEL");
  const [data, setData] = useState<RankingItem[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myTopPercent, setMyTopPercent] = useState<number | null>(null);
  const [totalPublic, setTotalPublic] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gyms, setGyms] = useState<MyGym[]>([]);
  // null = 전체, 아니면 그 모임 슬러그
  const [gymSlug, setGymSlug] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMyActiveGyms().then((list) => {
      if (!cancelled) setGyms(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // 범위 · 종류를 빨리 바꿀 때 늦게 온 이전 응답이 덮어쓰지 않게
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const gymParam = gymSlug ? `&gym=${encodeURIComponent(gymSlug)}` : "";
        const res = await api<RankingResponse>(`/api/rankings/characters?type=${type}&limit=50${gymParam}`);
        if (cancelled) return;
        setData(res.items);
        setMyRank(res.myRank ?? null);
        setMyTopPercent(res.myTopPercent ?? null);
        setTotalPublic(res.totalPublic ?? 0);
      } catch (e: unknown) {
        if (!cancelled) setError(friendlyError(e, "랭킹을 불러오지 못했어요."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type, gymSlug]);

  const tabIndex = TABS.findIndex((t) => t.key === type);

  return (
    <section className="pt-28 pb-20 px-5 md:px-10 min-h-screen text-white">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="space-y-2">
          <p className="text-sm font-bold text-plate-yellow">캐릭터 랭킹</p>
          <h1 className="text-3xl md:text-4xl">공개 랭킹</h1>
        </header>

        <div className="relative inline-grid grid-cols-2 border-b-2 border-steel-700" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={type === tab.key}
              onClick={() => setType(tab.key)}
              className={`px-6 pb-2 pt-1 text-lg font-black transition-colors ${
                type === tab.key ? "text-white" : "text-steel-400 hover:text-steel-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
          <span
            aria-hidden
            className="absolute -bottom-[2px] left-0 h-1 w-1/2 bg-plate-red transition-transform duration-300 ease-out"
            style={{ transform: `translateX(${tabIndex * 100}%)` }}
          />
        </div>

        {gyms.length > 0 && (
          // 범위: 전체 / 내 모임별. 모임 이름이 길면 자른다
          <div className="flex flex-wrap gap-2" role="group" aria-label="랭킹 범위">
            {[{ slug: null as string | null, name: "전체" }, ...gyms].map((g) => {
              const on = gymSlug === g.slug;
              return (
                <button
                  key={g.slug ?? "all"}
                  type="button"
                  aria-pressed={on}
                  title={g.name}
                  onClick={() => setGymSlug(g.slug)}
                  className={`min-h-[40px] max-w-[12rem] truncate rounded-md border-[3px] border-black px-4 py-1.5 text-sm font-bold transition-all duration-100 ${
                    on
                      ? "translate-y-[3px] bg-plate-blue text-white shadow-none"
                      : "bg-steel-700 text-steel-200 shadow hover:-translate-y-0.5 hover:shadow-md"
                  }`}
                >
                  {g.name}
                </button>
              );
            })}
          </div>
        )}

        <div className="dg-steel p-5 text-sm text-steel-300 grid grid-cols-3 gap-3">
          <div className="dg-well px-4 py-3">
            <div className="text-xs font-bold text-steel-400">
              {type === "LEVEL" ? "내 레벨 순위" : "내 3대 순위"}
            </div>
            <div className="font-num text-3xl font-black text-plate-yellow">
              {myRank !== null ? <CountNumber value={myRank} /> : "-"}
            </div>
          </div>
          <div className="dg-well px-4 py-3">
            <div className="text-xs font-bold text-steel-400">상위</div>
            <div className="font-num text-3xl font-black text-white">{myTopPercent !== null ? `${myTopPercent}%` : "-"}</div>
          </div>
          <div className="dg-well px-4 py-3">
            <div className="text-xs font-bold text-steel-400">{gymSlug ? "이 모임 공개 캐릭터" : "공개 캐릭터"}</div>
            <div className="font-num text-3xl font-black text-white">
              <CountNumber value={totalPublic} />
              <span className="ml-1 font-sans text-sm font-bold text-steel-400">명</span>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-3 text-steel-300">
            <span className="dg-loading-plates" aria-label="불러오는 중">
              <i />
              <i />
              <i />
              <i />
            </span>
            불러오는 중...
          </div>
        )}
        {error && <div className="text-red-400">{error}</div>}
        {type === "THREE_LIFT" && data.some((item) => item.selfReported) && (
          <p className="text-xs text-steel-400">3대 중량은 각자 본인이 입력한 기록이에요. 측정·검증된 값이 아니에요.</p>
        )}

        <div className="space-y-3" key={`${type}-${gymSlug ?? "all"}`}>
          {data.map((item, idx) => {
            const rank = idx + 1;
            const top = rank <= 3;
            return (
              <div
                key={`${item.nickname}-${idx}`}
                className={`dg-rise dg-lift flex items-center gap-4 rounded-xl border-[3px] border-black p-4 shadow-md ${
                  top ? "bg-steel-800" : "bg-steel-900"
                } ${rank === 1 ? "outline outline-2 outline-plate-yellow" : ""}`}
                style={{ animationDelay: `${Math.min(idx, 15) * 50}ms` }}
              >
                {top ? (
                  <PlateMedal rank={rank} />
                ) : (
                  <span className="font-num w-14 flex-none text-center text-4xl font-black text-steel-500">{rank}</span>
                )}
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold">{item.nickname}</p>
                    <p className="font-num text-sm font-semibold text-steel-400">
                      Lv.{item.level} · {item.tier} · {item.evolutionStage}단계
                    </p>
                  </div>
                  <div className="text-right text-sm text-steel-300">
                    <p className="font-semibold text-white">{item.title}</p>
                    {type === "THREE_LIFT" ? (
                      <p className="font-num text-2xl font-black text-plate-yellow">
                        <CountNumber value={item.threeLiftTotal ?? 0} />
                        <span className="ml-1 text-xs text-steel-400">kg</span>
                      </p>
                    ) : (
                      <p className="font-num text-2xl font-black text-plate-yellow">
                        <span className="mr-1 text-xs text-steel-400">Lv.</span>
                        <CountNumber value={item.level} />
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {data.length === 0 && !loading && <div className="dg-well p-6 text-center text-steel-400">{gymSlug ? "이 모임엔 아직 공개된 캐릭터가 없어요." : "아직 공개된 캐릭터가 없어요."}</div>}
        </div>
      </div>
    </section>
  );
}
