import { useEffect, useState } from "react";

type RankingItem = {
  nickname: string;
  level: number;
  tier: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND";
  evolutionStage: number;
  title: string;
  threeLiftTotal?: number | null;
  updatedAt?: string | null;
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

export default function Rankings() {
  const [type, setType] = useState<"LEVEL" | "THREE_LIFT">("LEVEL");
  const [data, setData] = useState<RankingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api<RankingItem[]>(`/api/rankings/characters?type=${type}&limit=50`);
        setData(res);
      } catch (e: any) {
        setError(e?.message || "Failed to load rankings.");
      } finally {
        setLoading(false);
      }
    })();
  }, [type]);

  return (
    <section className="pt-28 pb-20 px-5 md:px-10 bg-gradient-to-br from-slate-900 via-slate-950 to-neutral-900 min-h-screen text-white">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-amber-300">Character Rankings</p>
          <h1 className="text-3xl md:text-4xl font-extrabold">Public Rankings</h1>
        </header>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setType("LEVEL")}
            className={`px-4 py-2 rounded-full text-sm border transition ${
              type === "LEVEL" ? "border-amber-300 bg-amber-400/20" : "border-white/20"
            }`}
          >
            Level
          </button>
          <button
            onClick={() => setType("THREE_LIFT")}
            className={`px-4 py-2 rounded-full text-sm border transition ${
              type === "THREE_LIFT" ? "border-amber-300 bg-amber-400/20" : "border-white/20"
            }`}
          >
            3-Lift
          </button>
        </div>

        {loading && <div className="text-gray-300">Loading...</div>}
        {error && <div className="text-red-400">{error}</div>}

        <div className="space-y-3">
          {data.map((item, idx) => (
            <div key={`${item.nickname}-${idx}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold">{item.nickname}</p>
                  <p className="text-sm text-gray-400">
                    Lv.{item.level} - {item.tier} - Stage {item.evolutionStage}
                  </p>
                </div>
                <div className="text-right text-sm text-gray-300">
                  <p className="font-semibold text-white">{item.title}</p>
                  {type === "THREE_LIFT" && (
                    <p className="text-xs text-gray-400">3-Lift {item.threeLiftTotal ?? 0}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
          {data.length === 0 && !loading && <div className="text-gray-400">No public characters yet.</div>}
        </div>
      </div>
    </section>
  );
}



