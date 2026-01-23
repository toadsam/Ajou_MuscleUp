import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { logEvent } from "../utils/analytics";

type Review = {
  id: number;
  rating: number;
  content: string;
  userEmail?: string | null;
  userNickname?: string | null;
  proteinName?: string | null;
  createdAt?: string | null;
};

type PageResponse<T> = {
  content?: T[];
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

type Protein = { id: number; name: string; category?: string; avgRating?: number | null };

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

const parseLocation = (category?: string) => {
  if (!category) return { region: "미지정", gym: "미지정" };
  const [regionRaw, gymRaw] = category.split("/");
  return {
    region: (regionRaw || "").trim() || "미지정",
    gym: (gymRaw || "").trim() || "미지정",
  };
};

const splitReview = (content: string) => {
  const parts = content.split("\n\n");
  if (parts.length === 1) return { product: parts[0], share: parts[0] };
  return { product: parts[0], share: parts.slice(1).join("\n\n") };
};

export default function Reviews() {
  const [items, setItems] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proteins, setProteins] = useState<Protein[]>([]);
  const [selectedProtein, setSelectedProtein] = useState<number | null>(1);
  const [searchParams, setSearchParams] = useSearchParams();

  const userRaw = localStorage.getItem("user");
  const user = userRaw ? (JSON.parse(userRaw) as { email?: string; role?: string }) : null;
  const isAdmin = (user?.role || "").toUpperCase().includes("ADMIN");
  const myEmail = user?.email;
  const canEdit = useMemo(
    () => (rev: Review) => !!myEmail && (rev.userEmail === myEmail || isAdmin),
    [myEmail, isAdmin]
  );

  const fetchReviews = async () => {
    try {
      setLoading(true);
      setError(null);
      const pid = selectedProtein ?? 1;
      const data = await api<PageResponse<Review>>(`/api/reviews?proteinId=${pid}`);
      const list = Array.isArray(data) ? data : data.content ?? [];
      setItems(list);
    } catch (e: any) {
      setError(e?.message || "리뷰를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
    if (selectedProtein) {
      const next = new URLSearchParams(searchParams);
      next.set("proteinId", String(selectedProtein));
      setSearchParams(next, { replace: true });
    }
  }, [selectedProtein]);

  useEffect(() => {
    const loadProteins = async () => {
      try {
        const data = await api<PageResponse<Protein>>("/api/proteins");
        const list = Array.isArray(data) ? data : data.content ?? [];
        setProteins(list);
        const pidFromUrl = Number(searchParams.get("proteinId") || list[0]?.id || 1);
        setSelectedProtein(pidFromUrl);
      } catch {
        // ignore failure; keep default
      }
    };
    loadProteins();
  }, []);

  useEffect(() => {
    logEvent("reviews", "page_view");
  }, []);

  const navigate = useNavigate();

  const summary = useMemo(() => {
    if (!items.length) {
      return { avg: 0, distribution: 0, punctual: 0, reDeal: 0 };
    }
    const avg = items.reduce((sum, r) => sum + r.rating, 0) / items.length;
    const distribution = Math.max(0, Math.min(5, avg - 0.2));
    const punctual = Math.max(0, Math.min(5, avg - 0.1));
    const reDeal = Math.round((avg / 5) * 100);
    return { avg, distribution, punctual, reDeal };
  }, [items]);

  const selectedInfo = proteins.find((p) => p.id === selectedProtein);
  const { region, gym } = parseLocation(selectedInfo?.category);

  return (
    <section className="pt-24 pb-16 px-6 lg:px-12 bg-gradient-to-br from-[#0d0f12] via-[#151826] to-[#0b0d14] min-h-screen text-white">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-orange-200">Review + Trust</p>
            <h2 className="text-3xl md:text-4xl font-extrabold">제품 후기와 공구 경험 리뷰</h2>
          </div>
          <Link
            to="/reviews/write"
            className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full font-semibold hover:brightness-110 transition"
          >
            후기 작성하기
          </Link>
        </div>

        <div className="glass-panel p-5 flex flex-wrap items-center gap-4 justify-between">
          <div className="flex flex-wrap gap-3 items-center text-sm">
            <span className="text-white/60">제품 선택</span>
            <select
              className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
              value={selectedProtein ?? ""}
              onChange={(e) => setSelectedProtein(Number(e.target.value))}
            >
              {proteins.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#0d0f12]">
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-200">{region}</span>
            <span className="px-3 py-1 rounded-full bg-orange-500/20 text-orange-200">{gym}</span>
            <span className="px-3 py-1 rounded-full bg-white/10 text-white/60">나눔 기반 리뷰</span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-lg font-semibold">리뷰 요약</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs text-white/50">제품 만족도</p>
                <p className="text-2xl font-semibold text-emerald-200">{summary.avg.toFixed(1)} / 5</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs text-white/50">분배 정확성</p>
                <p className="text-2xl font-semibold text-emerald-200">{summary.distribution.toFixed(1)} / 5</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs text-white/50">약속 시간 준수</p>
                <p className="text-2xl font-semibold text-emerald-200">{summary.punctual.toFixed(1)} / 5</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs text-white/50">재거래 의향</p>
                <p className="text-2xl font-semibold text-orange-200">{summary.reDeal}%</p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/60">
              리뷰는 제품 만족도와 공구 경험을 함께 다룹니다. 지역 기반 신뢰 지표로 활용됩니다.
            </div>
          </div>

          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-lg font-semibold">신뢰 지표</h3>
            <div className="flex items-center justify-between text-sm text-white/70">
              <span>완료된 공구 수</span>
              <span>{Math.max(items.length, 1)}건</span>
            </div>
            <div className="flex items-center justify-between text-sm text-white/70">
              <span>평균 평점</span>
              <span>{summary.avg.toFixed(1)} / 5</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-white/60">
              후기 → 신뢰 상승 → 참여 증가 루프로 커뮤니티가 유지됩니다.
            </div>
          </div>
        </div>

        {loading && <p className="text-gray-300">불러오는 중...</p>}
        {error && <p className="text-red-400">{error}</p>}
        {!loading && items.length === 0 && <p className="text-gray-400">아직 등록된 후기가 없습니다.</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {items.map((r) => {
            const { product, share } = splitReview(r.content);
            return (
              <article
                key={r.id}
                className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 space-y-4 shadow-lg"
              >
                <div className="flex items-center justify-between text-sm text-white/60">
                  <span className="font-semibold">{r.userNickname || "익명 회원"}</span>
                  <span className="text-white/40">{formatDate(r.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-200">
                    제품 만족도 {r.rating}/5
                  </span>
                  <span className="px-3 py-1 rounded-full bg-orange-500/20 text-orange-200">
                    재거래 {r.rating >= 4 ? "YES" : "보류"}
                  </span>
                </div>
                <div className="space-y-3 text-sm text-white/80">
                  <div>
                    <p className="text-xs text-white/50">제품 리뷰</p>
                    <p className="whitespace-pre-wrap">{product}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/50">공구 경험</p>
                    <p className="whitespace-pre-wrap">{share}</p>
                  </div>
                </div>
                {r.proteinName && <p className="text-xs text-white/50">제품: {r.proteinName}</p>}

                {canEdit(r) && (
                  <div className="flex gap-2 text-xs">
                    <button
                      className="rounded-full border border-white/20 px-3 py-1 text-white/80 hover:border-white"
                      onClick={() => navigate("/reviews/write", { state: { review: r } })}
                    >
                      수정
                    </button>
                    <button
                      className="rounded-full border border-red-500 px-3 py-1 text-red-200 hover:bg-red-600/20"
                      onClick={async () => {
                        if (!confirm("리뷰를 삭제할까요?")) return;
                        try {
                          await api(`/api/reviews/${r.id}`, { method: "DELETE" });
                          setItems((prev) => prev.filter((x) => x.id !== r.id));
                        } catch (e: any) {
                          alert(e?.message || "삭제에 실패했습니다.");
                        }
                      }}
                    >
                      삭제
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
