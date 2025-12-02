import { useCallback, useEffect, useState } from "react";
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
  authorEmail?: string | null;
  createdAt?: string | null;
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
const formatDate = (v?: string | null) => {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

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

export default function BragList() {
  const [posts, setPosts] = useState<BragPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [likes, setLikes] = useState<Record<number, { count: number; liked: boolean }>>({});

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api<PageResponse<BragPost>>("/api/brags");
      const items = Array.isArray(data) ? data : data.content ?? [];
      setPosts(items);
    } catch (e: any) {
      setError(e?.message || "자랑 목록을 불러오지 못했어요.");
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
    posts.forEach((p) => fetchLikeStatus(p.id));
  }, [posts, fetchLikeStatus]);

  const toggleLike = async (postId: number) => {
    try {
      const res = await api<BragLikeResponse>(`/api/brags/${postId}/like`, { method: "POST" });
      setLikes((prev) => ({ ...prev, [postId]: { count: res.likeCount, liked: res.liked } }));
    } catch (e: any) {
      alert(e?.message || "좋아요 처리에 실패했어요.");
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    logEvent("brag_list", "page_view");
  }, []);

  return (
    <section className="pt-32 pb-20 px-5 md:px-10 bg-gradient-to-br from-gray-900 via-black to-gray-800 min-h-screen text-white">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-pink-300">우리 회원 자랑방</p>
            <h1 className="text-3xl md:text-4xl font-extrabold">최신 자랑 모음</h1>
          </div>
          <a
            href="/brag/write"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-pink-500 to-orange-500 px-5 py-3 font-semibold hover:opacity-90 transition"
          >
            자랑 올리기
          </a>
        </header>

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl bg-gray-800/60 h-28" />
            ))}
          </div>
        )}

        {error && <p className="text-red-400">{error}</p>}

        {!loading && posts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-600 bg-gray-800/40 p-10 text-center text-gray-300">
            아직 자랑이 없어요. 첫 번째 기록을 남겨주세요!
          </div>
        )}

        <div className="space-y-4">
          {posts.map((post) => (
            <article
              key={post.id}
              className="rounded-2xl border border-white/5 bg-gray-800/70 backdrop-blur-md p-6 shadow-lg"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-pink-300 font-semibold">{post.authorNickname || "익명 회원"}</p>
                  <p className="text-xs text-gray-400">{formatDate(post.createdAt)}</p>
                </div>
                {(post.movement || post.weight) && (
                  <div className="px-3 py-2 rounded-xl bg-gray-900 text-sm text-gray-200 border border-gray-700">
                    {post.movement && <span className="font-semibold">{post.movement}</span>}
                    {post.movement && post.weight && <span className="text-gray-500 mx-1">·</span>}
                    {post.weight && <span>{post.weight}</span>}
                  </div>
                )}
              </div>

              <Link to={`/brag/${post.id}`} className="mt-3 block text-xl font-bold hover:text-pink-200 transition">
                {post.title}
              </Link>
              <p className="mt-2 text-gray-200 leading-relaxed whitespace-pre-line">{post.content}</p>

              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={() => toggleLike(post.id)}
                  className="flex items-center gap-2 rounded-full border border-pink-400/50 px-3 py-1 text-sm text-pink-200 hover:bg-pink-500/10 transition"
                >
                  <span>👍</span>
                  <span>{likes[post.id]?.count ?? post.likeCount ?? 0}</span>
                  <span className="text-xs">{likes[post.id]?.liked ? "좋아요 취소" : "좋아요"}</span>
                </button>
                <a
                  href={`/brag/${post.id}#comments`}
                  className="text-sm text-gray-300 hover:text-white underline-offset-2 hover:underline"
                >
                  댓글 보기/쓰기
                </a>
              </div>

              {post.mediaUrls && post.mediaUrls.length > 0 && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {post.mediaUrls.map((rawUrl) => {
                    const url = withBase(rawUrl);
                    return (
                      <button
                        key={rawUrl}
                        onClick={() => setLightbox(url)}
                        className="group rounded-xl overflow-hidden border border-gray-700 bg-gray-900 relative"
                      >
                        {isVideo(url) ? (
                          <video src={url} className="w-full h-48 object-cover" muted />
                        ) : (
                          <img src={url} alt="" className="w-full h-48 object-cover" />
                        )}
                        <span className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition" />
                      </button>
                    );
                  })}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-5xl w-full flex justify-center">
            {isVideo(lightbox) ? (
              <video src={lightbox} controls autoPlay className="max-h-[90vh] max-w-[90vw]" />
            ) : (
              <img src={lightbox} className="max-h-[90vh] max-w-[90vw]" alt="" />
            )}
            <button
              className="absolute -top-3 -right-3 bg-black/80 text-white rounded-full px-3 py-1 text-sm"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox(null);
              }}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
