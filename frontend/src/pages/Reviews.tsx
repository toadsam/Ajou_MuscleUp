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
  if (!category) return { region: "미정", gym: "미정" };
  const [regionRaw, gymRaw] = category.split("/");
  return {
    region: (regionRaw || "").trim() || "미정",
    gym: (gymRaw || "").trim() || "미정",
  };
};

const splitReview = (content: string) => {
  const parts = content.split("\n\n");
  if (parts.length === 1) return { product: parts[0], share: parts[0] };
  return { product: parts[0], share: parts.slice(1).join("\n\n") };
};

const getTrustBadge = (rating: number) => {
  if (rating >= 4.5) return "강력 추천";
  if (rating >= 4) return "신뢰 가능";
  if (rating >= 3) return "확인 필요";
  return "신중 추천";
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
    [isAdmin, myEmail]
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
      setError(e?.message || "후기를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReviews();
    if (selectedProtein) {
      const next = new URLSearchParams(searchParams);
      next.set("proteinId", String(selectedProtein));
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, selectedProtein, setSearchParams]);

  useEffect(() => {
    const loadProteins = async () => {
      try {
        const data = await api<PageResponse<Protein>>("/api/proteins");
        const list = Array.isArray(data) ? data : data.content ?? [];
        setProteins(list);
        const pidFromUrl = Number(searchParams.get("proteinId") || list[0]?.id || 1);
        setSelectedProtein(pidFromUrl);
      } catch {
        // keep default
      }
    };
    void loadProteins();
  }, []);

  useEffect(() => {
    logEvent("reviews", "page_view");
  }, []);

  const navigate = useNavigate();

  const summary = useMemo(() => {
    if (!items.length) {
      return { avg: 0, trust: 0, punctual: 0, reDeal: 0 };
    }
    const avg = items.reduce((sum, r) => sum + r.rating, 0) / items.length;
    const trust = Math.max(0, Math.min(5, avg));
    const punctual = Math.max(0, Math.min(5, avg - 0.1));
    const reDeal = Math.round((avg / 5) * 100);
    return { avg, trust, punctual, reDeal };
  }, [items]);

  const selectedInfo = proteins.find((p) => p.id === selectedProtein);
  const { region, gym } = parseLocation(selectedInfo?.category);

  return (
    <section className="min-h-screen bg-gradient-to-br from-[#0d0f12] via-[#151826] to-[#0b0d14] px-5 pb-16 pt-24 text-white lg:px-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="grid gap-5 rounded-[30px] border border-white/10 bg-gradient-to-br from-emerald-500/12 via-white/5 to-orange-500/10 p-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.4em] text-orange-200">Review + Trust</p>
            <h2 className="text-3xl font-extrabold md:text-5xl">공동구매 신뢰 후기</h2>
            <p className="max-w-2xl text-sm text-white/65">
              이 페이지는 단백질 맛 후기만 보는 곳이 아니라, 대표 구매자가 믿을 만한지,
              분배 약속을 잘 지키는지 확인하는 공간입니다.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/reviews/write"
                className="rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2 font-semibold"
              >
                후기 작성하기
              </Link>
              {selectedProtein && (
                <Link
                  to={`/proteins/${selectedProtein}`}
                  className="rounded-full border border-white/15 px-5 py-2 text-sm text-white/75"
                >
                  모집글 보기
                </Link>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
            <div className="text-xs font-semibold tracking-[0.24em] text-emerald-200">이 후기로 보는 것</div>
            <div className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-1">
              {[
                "제품 만족도",
                "대표 구매자 신뢰도",
                "분배 약속 이행 여부",
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </header>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-white/60">모집글 선택</span>
              <select
                className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white"
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
              <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-emerald-200">{region}</span>
              <span className="rounded-full bg-orange-500/20 px-3 py-1 text-orange-200">{gym}</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-white/60">공동구매 후기 기반</span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-semibold">한눈에 보는 신뢰도</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs text-white/50">평균 만족도</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-200">{summary.avg.toFixed(1)} / 5</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs text-white/50">대표 신뢰도</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-200">{summary.trust.toFixed(1)} / 5</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs text-white/50">분배 약속 이행</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-200">{summary.punctual.toFixed(1)} / 5</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs text-white/50">재참여 의향</p>
                <p className="mt-2 text-2xl font-semibold text-orange-200">{summary.reDeal}%</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-semibold">초보자 판단 기준</h3>
            <div className="mt-4 space-y-3 text-sm text-white/70">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                평점이 4점 이상이면 기본 신뢰는 괜찮은 편입니다.
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                후기에서 분배 시간, 약속 장소, 응답 속도를 먼저 확인하세요.
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                대표 구매자와 다시 거래하겠다는 의견이 많으면 안정적입니다.
              </div>
            </div>
          </div>
        </div>

        {loading && <p className="text-gray-300">후기를 불러오는 중입니다...</p>}
        {error && <p className="text-red-400">{error}</p>}
        {!loading && items.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
            아직 등록된 후기가 없습니다.
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {items.map((r) => {
            const { product, share } = splitReview(r.content);
            return (
              <article
                key={r.id}
                className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl shadow-lg"
              >
                <div className="flex items-center justify-between text-sm text-white/60">
                  <span className="font-semibold">{r.userNickname || "익명 회원"}</span>
                  <span className="text-white/40">{formatDate(r.createdAt)}</span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-emerald-200">
                    만족도 {r.rating}/5
                  </span>
                  <span className="rounded-full bg-orange-500/20 px-3 py-1 text-orange-200">
                    {getTrustBadge(r.rating)}
                  </span>
                </div>

                <div className="mt-4 grid gap-4 text-sm text-white/80">
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-xs text-white/50">제품 후기</p>
                    <p className="mt-2 whitespace-pre-wrap">{product}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-xs text-white/50">공동구매 경험</p>
                    <p className="mt-2 whitespace-pre-wrap">{share}</p>
                  </div>
                </div>

                {r.proteinName && <p className="mt-4 text-xs text-white/50">모집글: {r.proteinName}</p>}

                {canEdit(r) && (
                  <div className="mt-4 flex gap-2 text-xs">
                    <button
                      className="rounded-full border border-white/20 px-3 py-1 text-white/80 hover:border-white"
                      onClick={() => navigate("/reviews/write", { state: { review: r } })}
                    >
                      수정
                    </button>
                    <button
                      className="rounded-full border border-red-500 px-3 py-1 text-red-200 hover:bg-red-600/20"
                      onClick={async () => {
                        if (!confirm("후기를 삭제할까요?")) return;
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
