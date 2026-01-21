import { useEffect, useMemo, useState } from "react";
import CharacterCard from "../components/CharacterCard";

type BragPost = {
  id: number;
  title: string;
  movement?: string | null;
  weight?: string | null;
  likeCount?: number;
};

type BragComment = {
  id: number;
  content: string;
  authorNickname?: string | null;
  createdAt?: string | null;
};

type AiChatLogItem = {
  question: string;
  answer: string;
  createdAt?: string | null;
};

type MyPageResponse = {
  email: string;
  nickname: string;
  recentComments: BragComment[];
  recentLikes: BragPost[];
  recentAiChats: AiChatLogItem[];
};

type UserBodyStats = {
  heightCm: number | null;
  gender: "MALE" | "FEMALE" | null;
  weightKg: number | null;
  skeletalMuscleKg: number | null;
  benchKg: number | null;
  squatKg: number | null;
  deadliftKg: number | null;
  updatedAt?: string | null;
};

type CharacterProfile = {
  level: number;
  tier: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND";
  evolutionStage: number;
  title: string;
  isPublic: boolean;
  lastEvaluatedAt?: string | null;
};

type CharacterEvaluation = {
  threeLiftTotal: number;
  strengthRatio: number;
  totalScore: number;
  level: number;
  tier: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND";
  evolutionStage: number;
  title: string;
};

type CharacterChange = {
  leveledUp: boolean;
  evolved: boolean;
  tierChanged: boolean;
};

type StatsCharacterResponse = {
  stats: UserBodyStats;
  character: CharacterProfile;
  evaluation: CharacterEvaluation;
  change: CharacterChange;
};

type Toast = { type: "success" | "error"; message: string };

type EffectBanner = { message: string; kind: "level" | "evolution" | "tier" };

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const url = API_BASE ? `${API_BASE}${path}` : path;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    credentials: "include",
    ...init,
  });
  if (res.status === 401) {
    alert("로그인이 필요합니다.");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

const formatDate = (v?: string | null) => {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const emptyForm = {
  heightCm: "",
  gender: "MALE",
  weightKg: "",
  skeletalMuscleKg: "",
  benchKg: "",
  squatKg: "",
  deadliftKg: "",
};

type StatsForm = typeof emptyForm;

export default function MyPage() {
  const [data, setData] = useState<MyPageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<UserBodyStats | null>(null);
  const [character, setCharacter] = useState<CharacterProfile | null>(null);
  const [evaluation, setEvaluation] = useState<CharacterEvaluation | null>(null);
  const [change, setChange] = useState<CharacterChange | null>(null);
  const [form, setForm] = useState<StatsForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [banner, setBanner] = useState<EffectBanner | null>(null);
  const [publicUpdating, setPublicUpdating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [pageRes, statsRes, characterRes] = await Promise.all([
          api<MyPageResponse>("/api/mypage"),
          api<UserBodyStats | null>("/api/mypage/stats"),
          api<CharacterProfile>("/api/character/me"),
        ]);
        setData(pageRes);
        setStats(statsRes);
        setCharacter(characterRes);

        if (statsRes) {
          setForm({
            heightCm: statsRes.heightCm?.toString() ?? "",
            gender: statsRes.gender ?? "MALE",
            weightKg: statsRes.weightKg?.toString() ?? "",
            skeletalMuscleKg: statsRes.skeletalMuscleKg?.toString() ?? "",
            benchKg: statsRes.benchKg?.toString() ?? "",
            squatKg: statsRes.squatKg?.toString() ?? "",
            deadliftKg: statsRes.deadliftKg?.toString() ?? "",
          });
          try {
            const evalRes = await api<StatsCharacterResponse>("/api/character/evaluate", { method: "POST" });
            setCharacter(evalRes.character);
            setEvaluation(evalRes.evaluation);
            setChange(null);
          } catch (e) {
            setEvaluation(null);
          }
        } else {
          setForm(emptyForm);
        }
      } catch (e: any) {
        setError(e?.message || "마이페이지 정보를 불러오지 못했어요.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!change) return;
    if (change.evolved) {
      setBanner({ message: "EVOLUTION!", kind: "evolution" });
    } else if (change.leveledUp) {
      setBanner({ message: "LEVEL UP!", kind: "level" });
    } else if (change.tierChanged) {
      setBanner({ message: "TIER UP!", kind: "tier" });
    } else {
      return;
    }
    const timer = window.setTimeout(() => setBanner(null), 2000);
    return () => window.clearTimeout(timer);
  }, [change]);

  const showToast = (next: Toast) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 2000);
  };

  const parseNumber = (value: string) => {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const saveStats = async () => {
    const payload = {
      heightCm: parseNumber(form.heightCm),
      gender: form.gender,
      weightKg: parseNumber(form.weightKg),
      skeletalMuscleKg: parseNumber(form.skeletalMuscleKg),
      benchKg: parseNumber(form.benchKg),
      squatKg: parseNumber(form.squatKg),
      deadliftKg: parseNumber(form.deadliftKg),
    };

    if (payload.weightKg === null || payload.weightKg < 20 || payload.weightKg > 300) {
      showToast({ type: "error", message: "몸무게는 20~300kg 사이로 입력해 주세요." });
      return;
    }

    try {
      setSaving(true);
      const res = await api<StatsCharacterResponse>("/api/mypage/stats", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setStats(res.stats);
      setCharacter(res.character);
      setEvaluation(res.evaluation);
      setChange(res.change);
      showToast({ type: "success", message: "스탯이 저장되었습니다." });
    } catch (e: any) {
      showToast({ type: "error", message: e?.message || "저장에 실패했습니다." });
    } finally {
      setSaving(false);
    }
  };

  const togglePublic = async () => {
    if (!character) return;
    try {
      setPublicUpdating(true);
      const res = await api<CharacterProfile>("/api/character/me/public", {
        method: "PUT",
        body: JSON.stringify({ isPublic: !character.isPublic }),
      });
      setCharacter(res);
      showToast({ type: "success", message: res.isPublic ? "공개로 전환했어요." : "비공개로 전환했어요." });
    } catch (e: any) {
      showToast({ type: "error", message: e?.message || "설정 변경에 실패했습니다." });
    } finally {
      setPublicUpdating(false);
    }
  };

  const statInputs = useMemo(
    () => [
      { key: "heightCm", label: "키(cm)", placeholder: "170", step: "1" },
      { key: "gender", label: "성별", placeholder: "", step: "" },
      { key: "weightKg", label: "몸무게(kg)", placeholder: "72.5", step: "0.1" },
      { key: "skeletalMuscleKg", label: "골격근량(kg)", placeholder: "33", step: "0.1" },
      { key: "benchKg", label: "벤치(kg)", placeholder: "90", step: "0.5" },
      { key: "squatKg", label: "스쿼트(kg)", placeholder: "120", step: "0.5" },
      { key: "deadliftKg", label: "데드(kg)", placeholder: "140", step: "0.5" },
    ],
    []
  );

  return (
    <section className="pt-32 pb-20 px-5 md:px-10 bg-gradient-to-br from-gray-900 via-black to-gray-800 min-h-screen text-white">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.3em] text-pink-300">내 기록</p>
          <h1 className="text-3xl md:text-4xl font-extrabold">마이페이지</h1>
          {data && (
            <p className="text-gray-300">
              {data.nickname} ({data.email})
            </p>
          )}
        </header>

        {loading && <div className="text-gray-300">불러오는 중...</div>}
        {error && <div className="text-red-400">{error}</div>}

        <div className="grid lg:grid-cols-[1.15fr,1fr] gap-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">내 스탯 입력</h2>
              {stats?.updatedAt && (
                <span className="text-xs text-gray-400">최근 저장 {formatDate(stats.updatedAt)}</span>
              )}
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {statInputs.map((field) => (
                <label key={field.key} className="text-sm text-gray-300 space-y-2">
                  <span>{field.label}</span>
                  {field.key === "gender" ? (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, gender: "MALE" }))}
                        className={`px-4 py-2 rounded-full text-xs border transition ${
                          form.gender === "MALE" ? "border-pink-400 bg-pink-500/20" : "border-white/20"
                        }`}
                      >
                        남
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, gender: "FEMALE" }))}
                        className={`px-4 py-2 rounded-full text-xs border transition ${
                          form.gender === "FEMALE" ? "border-pink-400 bg-pink-500/20" : "border-white/20"
                        }`}
                      >
                        여
                      </button>
                    </div>
                  ) : (
                    <input
                      type="number"
                      step={field.step}
                      placeholder={field.placeholder}
                      value={form[field.key as keyof StatsForm] as string}
                      onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">몸무게는 필수 입력입니다.</span>
              <button
                onClick={saveStats}
                disabled={saving}
                className="px-5 py-2 rounded-full bg-pink-500 text-white text-sm font-semibold hover:bg-pink-400 transition disabled:opacity-60"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>

          {character ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">내 캐릭터</h2>
                <button
                  onClick={togglePublic}
                  disabled={publicUpdating}
                  className={`px-4 py-2 rounded-full text-xs font-semibold border transition ${
                    character.isPublic
                      ? "border-emerald-400 text-emerald-200"
                      : "border-white/30 text-gray-200"
                  }`}
                >
                  {character.isPublic ? "공개 중" : "비공개"}
                </button>
              </div>
              <CharacterCard character={character} evaluation={evaluation} gender={stats?.gender ?? "MALE"} change={change} />
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-gray-300">
              캐릭터 정보를 불러오는 중입니다.
            </div>
          )}
        </div>

        {data && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-white/5 bg-gray-800/70 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">최근 댓글</h2>
                <span className="text-sm text-gray-400">최대 20개</span>
              </div>
              {data.recentComments.length === 0 && <p className="text-gray-400 text-sm">댓글 기록이 없습니다.</p>}
              <div className="space-y-3">
                {data.recentComments.map((c) => (
                  <div key={c.id} className="rounded-xl bg-gray-900/60 border border-gray-700 p-3">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{c.authorNickname || "익명"}</span>
                      <span>{formatDate(c.createdAt)}</span>
                    </div>
                    <p className="text-gray-200 mt-1 whitespace-pre-line">{c.content}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-gray-800/70 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">좋아요한 글</h2>
                <span className="text-sm text-gray-400">최신순</span>
              </div>
              {data.recentLikes.length === 0 && <p className="text-gray-400 text-sm">좋아요 기록이 없습니다.</p>}
              <div className="space-y-3">
                {data.recentLikes.map((p) => (
                  <a
                    key={p.id}
                    href={`/brag/${p.id}`}
                    className="block rounded-xl bg-gray-900/60 border border-gray-700 p-3 hover:border-pink-400/50 transition"
                  >
                    <div className="flex justify-between items-center">
                      <p className="font-semibold text-pink-200">{p.title}</p>
                      <span className="text-sm text-gray-400">Likes {p.likeCount ?? 0}</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">
                      {p.movement || "-"} {p.weight ? `· ${p.weight}` : ""}
                    </p>
                  </a>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 rounded-2xl border border-white/5 bg-gray-800/70 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">AI 사용 기록</h2>
                <span className="text-sm text-gray-400">최대 20개</span>
              </div>
              {data.recentAiChats.length === 0 && <p className="text-gray-400 text-sm">AI 기록이 없습니다.</p>}
              <div className="grid md:grid-cols-2 gap-3">
                {data.recentAiChats.map((item, idx) => (
                  <div key={idx} className="rounded-xl bg-gray-900/60 border border-gray-700 p-3 space-y-1">
                    <div className="text-xs text-gray-500">{formatDate(item.createdAt)}</div>
                    <p className="text-sm font-semibold text-white">Q. {item.question}</p>
                    <p className="text-sm text-gray-200 whitespace-pre-line">A. {item.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div
          className={`fixed top-24 right-6 z-50 rounded-full px-4 py-2 text-sm shadow-lg ${
            toast.type === "success" ? "bg-emerald-400 text-black" : "bg-rose-500 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      {banner && (
        <div
          className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-sm font-bold tracking-[0.3em] shadow-xl ${
            banner.kind === "evolution"
              ? "bg-cyan-400 text-black"
              : banner.kind === "tier"
              ? "bg-amber-300 text-black"
              : "bg-pink-500 text-white"
          }`}
        >
          {banner.message}
        </div>
      )}
    </section>
  );
}


