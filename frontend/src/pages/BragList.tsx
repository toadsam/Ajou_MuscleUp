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
    throw new Error("로그인이 필요합니다.");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

const extractSummary = (content: string) => {
  const clean = content.replace(/---\s*META[\s\S]*?---/gi, "").trim();
  return clean.length > 110 ? `${clean.slice(0, 110)}...` : clean;
};

const buildShareUrl = (postId: number) => `${window.location.origin}/brag/${postId}`;

export default function BragList() {
  const [posts, setPosts] = useState<BragPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<"ALL" | "FRIENDS">("ALL");
  const [likes, setLikes] = useState<Record<number, { count: number; liked: boolean }>>({});
  const [shareMessage, setShareMessage] = useState<string | null>(null);

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
      // keep feed usable even when like status fails
    }
  }, []);

  useEffect(() => {
    void fetchPosts();
    logEvent("brag_list", "page_view");
  }, [fetchPosts]);

  useEffect(() => {
    posts.forEach((post) => void fetchLikeStatus(post.id));
  }, [posts, fetchLikeStatus]);

  useEffect(() => {
    if (!shareMessage) return;
    const timer = window.setTimeout(() => setShareMessage(null), 2200);
    return () => window.clearTimeout(timer);
  }, [shareMessage]);

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

  const featuredTemplates = [
    { label: "PR 달성", desc: "무게나 횟수를 자랑하는 가장 쉬운 템플릿", emoji: "🏆" },
    { label: "오늘 운동", desc: "오늘 한 운동과 한 줄 소감을 빠르게 기록", emoji: "🔥" },
    { label: "체형 변화", desc: "Before / After 비교 사진 중심 공유", emoji: "📸" },
  ];

  const toggleLike = async (postId: number) => {
    try {
      const res = await api<BragLikeResponse>(`/api/brags/${postId}/like`, { method: "POST" });
      setLikes((prev) => ({ ...prev, [postId]: { count: res.likeCount, liked: res.liked } }));
    } catch (e: any) {
      alert(e?.message || "좋아요 처리에 실패했습니다.");
    }
  };

  const handleShare = async (post: BragPost) => {
    const url = buildShareUrl(post.id);
    const text = `${post.title}\n${extractSummary(post.content)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${post.authorNickname ?? "회원"}님의 운동 자랑`,
          text,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setShareMessage("공유 링크를 복사했습니다.");
      }
    } catch {
      // user cancelled or browser blocked share
    }
  };

  return (
    <section className="min-h-screen bg-slate-950 pt-28 pb-24 text-white">
      <div className="mx-auto max-w-6xl space-y-6 px-6 lg:px-10">
        <header className="grid gap-4 rounded-[28px] border border-white/10 bg-gradient-to-br from-orange-500/18 via-amber-400/10 to-white/5 p-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-3">
            <p className="text-sm font-semibold tracking-[0.28em] text-orange-200">BRAG</p>
            <h1 className="text-3xl font-extrabold md:text-5xl">운동 자랑방</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-white/70">
              기록이 짧아도 괜찮습니다. 오늘 운동, PR 달성, 체형 변화처럼 자랑할 주제만 고르면
              초보도 빠르게 올릴 수 있게 만들었습니다.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/brag/write" className="rounded-full bg-orange-500 px-5 py-2 font-semibold text-black">
                빠르게 자랑 올리기
              </Link>
              <a href="#brag-feed" className="rounded-full border border-white/15 px-5 py-2 text-sm text-white/75">
                최근 자랑 보기
              </a>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-1">
            {featuredTemplates.map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-2xl">{item.emoji}</div>
                <div className="mt-3 font-semibold">{item.label}</div>
                <p className="mt-1 text-sm text-white/60">{item.desc}</p>
              </div>
            ))}
          </div>
        </header>

        <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 lg:grid-cols-[0.65fr,1fr]">
          <div>
            <div className="text-sm font-semibold text-white">초보용 필터</div>
            <p className="mt-1 text-xs text-white/55">친구 공개 글만 따로 보거나 운동 종목으로 바로 찾을 수 있습니다.</p>
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setVisibilityFilter("ALL")}
                className={`rounded-full px-3 py-1 text-sm ${visibilityFilter === "ALL" ? "bg-orange-500 text-black" : "bg-black/30 text-gray-300"}`}
              >
                전체 보기
              </button>
              <button
                type="button"
                onClick={() => setVisibilityFilter("FRIENDS")}
                className={`rounded-full px-3 py-1 text-sm ${visibilityFilter === "FRIENDS" ? "bg-sky-500 text-black" : "bg-black/30 text-gray-300"}`}
              >
                친구 공개만
              </button>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="종목, 제목, 내용으로 검색"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm"
            />
          </div>
        </div>

        {shareMessage && (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {shareMessage}
          </div>
        )}

        {loading && (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={`brag-skeleton-${idx}`} className="overflow-hidden rounded-[26px] border border-white/10 bg-white/5">
                <div className="h-56 animate-pulse bg-white/10" />
                <div className="space-y-3 p-5">
                  <div className="h-4 w-2/5 animate-pulse rounded bg-white/10" />
                  <div className="h-6 w-4/5 animate-pulse rounded bg-white/10" />
                  <div className="h-4 w-full animate-pulse rounded bg-white/10" />
                  <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        )}
        {error && <p className="text-red-400">{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
            아직 표시할 자랑글이 없습니다. 첫 번째 자랑을 올려보세요.
          </div>
        )}

        <div id="brag-feed" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((post) => {
            const cover = post.mediaUrls?.[0];
            const likeState = likes[post.id];
            const summary = extractSummary(post.content);
            return (
              <article key={post.id} className="overflow-hidden rounded-[26px] border border-white/10 bg-white/5">
                {cover ? (
                  <div className="relative h-56 overflow-hidden border-b border-white/10">
                    {isVideo(cover) ? (
                      <video src={withBase(cover)} className="h-full w-full object-cover" muted controls />
                    ) : (
                      <img loading="lazy" decoding="async" src={withBase(cover)} alt={post.title} className="h-full w-full object-cover" />
                    )}
                    <div className="absolute left-4 top-4 flex gap-2 text-xs">
                      {post.visibility === "FRIENDS" && (
                        <span className="rounded-full bg-sky-500/85 px-3 py-1 font-semibold text-black">친구 공개</span>
                      )}
                      {post.movement && (
                        <span className="rounded-full bg-black/70 px-3 py-1 font-semibold text-white">{post.movement}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-40 items-end bg-gradient-to-br from-orange-500/25 via-amber-300/10 to-transparent p-5">
                    <div>
                      <div className="text-xs uppercase tracking-[0.28em] text-orange-200">Workout Brag</div>
                      <div className="mt-2 text-lg font-bold">{post.movement || "오늘 운동 기록"}</div>
                    </div>
                  </div>
                )}

                <div className="space-y-4 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{post.authorNickname ?? "익명 회원"}</div>
                      <div className="text-xs text-white/45">
                        {post.createdAt ? new Date(post.createdAt).toLocaleString("ko-KR") : ""}
                      </div>
                    </div>
                    {post.weight && (
                      <div className="rounded-full border border-orange-400/25 bg-orange-500/10 px-3 py-1 text-xs text-orange-100">
                        {post.weight}
                      </div>
                    )}
                  </div>

                  <div>
                    <Link to={`/brag/${post.id}`} className="line-clamp-2 text-xl font-bold hover:text-orange-200">
                      {post.title}
                    </Link>
                    <p className="mt-2 min-h-[64px] text-sm leading-relaxed text-white/70">{summary || "운동 기록이 등록되어 있습니다."}</p>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-white/55">
                    {post.movement && <span className="rounded-full bg-white/5 px-3 py-1">{post.movement}</span>}
                    <span className="rounded-full bg-white/5 px-3 py-1">좋아요 {likeState?.count ?? post.likeCount ?? 0}</span>
                    <span className="rounded-full bg-white/5 px-3 py-1">상세 보기 가능</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => void toggleLike(post.id)}
                      className={`flex-1 rounded-full border px-3 py-2 text-sm ${
                        likeState?.liked
                          ? "border-orange-300/60 bg-orange-400/20 text-orange-100"
                          : "border-white/10 text-white/75"
                      }`}
                    >
                      좋아요 {likeState?.count ?? post.likeCount ?? 0}
                    </button>
                    <button
                      onClick={() => void handleShare(post)}
                      className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/75"
                    >
                      공유
                    </button>
                    <Link to={`/brag/${post.id}`} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">
                      보기
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
