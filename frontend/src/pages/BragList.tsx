import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { logEvent } from "../utils/analytics";

type BragPost = {
  id: number;
  title: string;
  content: string;
  movement?: string | null;
  weight?: string | null;
  mediaUrls: string[];
  likeCount?: number;
  authorNickname?: string | null;
  createdAt?: string | null;
  visibility?: "PUBLIC" | "FRIENDS";
};

type PageResponse<T> = {
  content?: T[];
};

type BragLikeResponse = {
  likeCount: number;
  liked: boolean;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const withBase = (url: string) => (url?.startsWith("http") ? url : `${API_BASE}${url}`);
const isVideo = (url: string) => /\.(mp4|mov|webm|avi|mkv)(\?|$)/i.test(url.split("?")[0]);

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const url = API_BASE ? `${API_BASE}${path}` : path;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    credentials: "include",
    ...init,
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export default function BragList() {
  const [posts, setPosts] = useState<BragPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<"ALL" | "FRIENDS">("ALL");
  const [likes, setLikes] = useState<Record<number, { count: number; liked: boolean }>>({});

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api<PageResponse<BragPost>>("/api/brags");
      setPosts(Array.isArray(data) ? data : data.content ?? []);
    } catch (e: any) {
      setError(e?.message || "자랑글 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLikeStatus = useCallback(async (postId: number) => {
    try {
      const res = await api<BragLikeResponse>(`/api/brags/${postId}/like`);
      setLikes((prev) => ({ ...prev, [postId]: { count: res.likeCount, liked: res.liked } }));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void fetchPosts();
    logEvent("brag_list", "page_view");
  }, [fetchPosts]);

  useEffect(() => {
    posts.forEach((post) => void fetchLikeStatus(post.id));
  }, [posts, fetchLikeStatus]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return posts
      .filter((post) => (visibilityFilter === "FRIENDS" ? post.visibility === "FRIENDS" : true))
      .filter((post) => {
        if (!keyword) return true;
        return (
          post.title.toLowerCase().includes(keyword) ||
          post.content.toLowerCase().includes(keyword) ||
          (post.movement || "").toLowerCase().includes(keyword)
        );
      });
  }, [posts, search, visibilityFilter]);

  const toggleLike = async (postId: number) => {
    try {
      const res = await api<BragLikeResponse>(`/api/brags/${postId}/like`, { method: "POST" });
      setLikes((prev) => ({ ...prev, [postId]: { count: res.likeCount, liked: res.liked } }));
    } catch (e: any) {
      alert(e?.message || "좋아요 처리에 실패했습니다.");
    }
  };

  return (
    <section className="min-h-screen bg-slate-950 pt-28 pb-24 text-white">
      <div className="mx-auto max-w-6xl px-6 lg:px-10 space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-orange-300">BRAG</p>
            <h1 className="text-4xl font-extrabold">자랑방</h1>
            <p className="text-sm text-gray-300 mt-2">친구공개 글은 친구만 볼 수 있습니다.</p>
          </div>
          <Link to="/brag/write" className="rounded-full bg-orange-500 px-5 py-2 font-semibold text-black">
            자랑 올리기
          </Link>
        </header>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setVisibilityFilter("ALL")}
              className={`rounded-full px-3 py-1 text-sm ${visibilityFilter === "ALL" ? "bg-orange-500 text-black" : "bg-black/30 text-gray-300"}`}
            >
              전체
            </button>
            <button
              type="button"
              onClick={() => setVisibilityFilter("FRIENDS")}
              className={`rounded-full px-3 py-1 text-sm ${visibilityFilter === "FRIENDS" ? "bg-sky-500 text-black" : "bg-black/30 text-gray-300"}`}
            >
              친구만
            </button>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="제목/내용 검색"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm"
          />
        </div>

        {loading && <p className="text-gray-400">불러오는 중...</p>}
        {error && <p className="text-red-400">{error}</p>}
        {!loading && !error && filtered.length === 0 && <p className="text-gray-400">표시할 게시글이 없습니다.</p>}

        <div className="grid gap-4">
          {filtered.map((post) => {
            const cover = post.mediaUrls?.[0];
            return (
              <article key={post.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{post.authorNickname ?? "익명"}</p>
                    <p className="text-xs text-gray-400">{post.createdAt ? new Date(post.createdAt).toLocaleString("ko-KR") : ""}</p>
                  </div>
                  {post.visibility === "FRIENDS" && (
                    <span className="rounded-full bg-sky-500/20 px-2 py-1 text-xs text-sky-200">친구공개</span>
                  )}
                </div>

                <Link to={`/brag/${post.id}`} className="block text-xl font-bold hover:text-orange-200">
                  {post.title}
                </Link>
                <p className="mt-2 text-sm text-gray-300 line-clamp-3">{post.content}</p>

                {(post.movement || post.weight) && (
                  <p className="mt-2 text-xs text-gray-400">
                    {post.movement ?? "-"} · {post.weight ?? "-"}
                  </p>
                )}

                {cover && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
                    {isVideo(cover) ? (
                      <video src={withBase(cover)} className="h-44 w-full object-cover" muted controls />
                    ) : (
                      <img src={withBase(cover)} alt="cover" className="h-44 w-full object-cover" />
                    )}
                  </div>
                )}

                <div className="mt-3">
                  <button onClick={() => void toggleLike(post.id)} className="rounded-full border border-orange-400/40 px-3 py-1 text-sm text-orange-200">
                    좋아요 {likes[post.id]?.count ?? post.likeCount ?? 0}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
