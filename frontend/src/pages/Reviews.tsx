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
type Protein = { id: number; name: string };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const url = API_BASE ? `${API_BASE}${path}` : path;
  const token = localStorage.getItem("token");
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  });
  if (res.status === 401) {
    alert("로그인이 필요합니다.");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
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

  return (
    <section className="pt-32 p-12 bg-gradient-to-br from-gray-900 via-black to-gray-800 min-h-screen text-white">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl md:text-4xl font-extrabold">회원 리뷰</h2>
          <Link
            to="/reviews/write"
            className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 rounded-lg font-semibold hover:opacity-90 transition"
          >
            리뷰 작성하기
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap gap-3 items-center text-sm">
          <span className="text-gray-300">제품 선택</span>
          <select
            className="rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-white"
            value={selectedProtein ?? ""}
            onChange={(e) => setSelectedProtein(Number(e.target.value))}
          >
            {proteins.map((p) => (
              <option key={p.id} value={p.id} className="bg-gray-900">
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {loading && <p className="text-gray-300">불러오는 중...</p>}
        {error && <p className="text-red-400">{error}</p>}
        {!loading && items.length === 0 && <p className="text-gray-400">아직 등록된 리뷰가 없습니다.</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {items.map((r) => (
            <div key={r.id} className="bg-gray-800/70 backdrop-blur-md rounded-2xl overflow-hidden shadow hover:shadow-pink-500/40 transition p-5">
              <div className="flex items-center justify-between text-sm text-gray-300">
                <span className="font-semibold">{r.userNickname || "익명 회원"}</span>
                <span className="text-gray-400">{formatDate(r.createdAt)}</span>
              </div>
              <div className="mt-2 text-pink-300">
                {"★".repeat(r.rating)}{"☆".repeat(Math.max(0, 5 - r.rating))}
              </div>
              <p className="mt-3 text-gray-100 whitespace-pre-wrap">{r.content}</p>
              {r.proteinName && <p className="mt-2 text-xs text-gray-400">제품: {r.proteinName}</p>}

              {canEdit(r) && (
                <div className="mt-3 flex gap-2 text-xs">
                  <button
                    className="rounded-full border border-gray-600 px-3 py-1 text-gray-200 hover:border-pink-400"
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
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
