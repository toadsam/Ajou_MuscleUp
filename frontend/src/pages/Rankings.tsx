import { useEffect, useState, type CSSProperties } from "react";
import { useCountUp } from "../hooks/useCountUp";

type RankingItem = {
  nickname: string;
  level: number;
  tier: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND" | "MASTER" | "GRANDMASTER" | "CHALLENGER";
  evolutionStage: number;
  title: string;
  threeLiftTotal?: number | null;
  updatedAt?: string | null;
};

type RankingResponse = {
  items: RankingItem[];
  totalPublic: number;
  myRank: number | null;
  myTopPercent: number | null;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

async function api<T>(path: string): Promise<T> {
  const url = API_BASE ? `${API_BASE}${path}` : path;
  const res = await fetch(url, { credentials: "include" });
  if (res.status === 401) {
    alert("Login required.");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
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
  { key: "LEVEL", label: "Level" },
  { key: "THREE_LIFT", label: "3-Lift" },
];

export default function Rankings() {
  const [type, setType] = useState<"LEVEL" | "THREE_LIFT">("LEVEL");
  const [data, setData] = useState<RankingItem[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myTopPercent, setMyTopPercent] = useState<number | null>(null);
  const [totalPublic, setTotalPublic] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api<RankingResponse>(`/api/rankings/characters?type=${type}&limit=50`);
        setData(res.items);
        setMyRank(res.myRank ?? null);
        setMyTopPercent(res.myTopPercent ?? null);
        setTotalPublic(res.totalPublic ?? 0);
      } catch (e: any) {
        setError(e?.message || "Failed to load rankings.");
      } finally {
        setLoading(false);
      }
    })();
  }, [type]);

  const tabIndex = TABS.findIndex((t) => t.key === type);

  return (
    <section className="pt-28 pb-20 px-5 md:px-10 min-h-screen text-white">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="space-y-2">
          <p className="font-num text-sm font-bold text-plate-yellow">Character Rankings</p>
          <h1 className="text-3xl md:text-4xl">Public Rankings</h1>
        </header>

        <div className="relative inline-grid grid-cols-2 border-b-2 border-steel-700" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={type === tab.key}
              onClick={() => setType(tab.key)}
              className={`font-num px-6 pb-2 pt-1 text-lg font-black transition-colors ${
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

        <div className="dg-steel p-5 text-sm text-steel-300 grid grid-cols-3 gap-3">
          <div className="dg-well px-4 py-3">
            <div className="font-num text-xs font-bold text-steel-400">
              {type === "LEVEL" ? "My Level Rank" : "My 3-Lift Rank"}
            </div>
            <div className="font-num text-3xl font-black text-plate-yellow">
              {myRank !== null ? <CountNumber value={myRank} /> : "-"}
            </div>
          </div>
          <div className="dg-well px-4 py-3">
            <div className="font-num text-xs font-bold text-steel-400">Top Percent</div>
            <div className="font-num text-3xl font-black text-white">{myTopPercent !== null ? `${myTopPercent}%` : "-"}</div>
          </div>
          <div className="dg-well px-4 py-3">
            <div className="font-num text-xs font-bold text-steel-400">Public Total</div>
            <div className="font-num text-3xl font-black text-white">
              <CountNumber value={totalPublic} />
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
            Loading...
          </div>
        )}
        {error && <div className="text-red-400">{error}</div>}

        <div className="space-y-3" key={type}>
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
                      Lv.{item.level} - {item.tier} - Stage {item.evolutionStage}
                    </p>
                  </div>
                  <div className="text-right text-sm text-steel-300">
                    <p className="font-semibold text-white">{item.title}</p>
                    {type === "THREE_LIFT" ? (
                      <p className="font-num text-2xl font-black text-plate-yellow">
                        <CountNumber value={item.threeLiftTotal ?? 0} />
                        <span className="ml-1 text-xs text-steel-400">3-Lift</span>
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
          {data.length === 0 && !loading && <div className="dg-well p-6 text-center text-steel-400">No public characters yet.</div>}
        </div>
      </div>
    </section>
  );
}
