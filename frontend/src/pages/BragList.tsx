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

// 템플릿 아이콘(예전 이모지 자리) — 짧은 stroke SVG
function TemplateIcon({ kind }: { kind: "trophy" | "flame" | "camera" }) {
  const common = {
    viewBox: "0 0 24 24",
    className: "h-5 w-5",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (kind === "trophy") {
    return (
      <svg {...common}>
        <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
        <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8" />
      </svg>
    );
  }
  if (kind === "flame") {
    return (
      <svg {...common}>
        <path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 1.5 1 2.5 2 3 0-3-.5-5.5.5-8z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

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
    { label: "PR 달성", desc: "무게나 횟수를 자랑하는 가장 쉬운 템플릿", icon: "trophy" as const },
    { label: "오늘 운동", desc: "오늘 한 운동과 한 줄 소감을 빠르게 기록", icon: "flame" as const },
    { label: "체형 변화", desc: "Before / After 비교 사진 중심 공유", icon: "camera" as const },
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
    <section className="min-h-screen pt-28 pb-24 text-white">
      <div className="mx-auto max-w-6xl space-y-6 px-6 lg:px-10">
        <header className="dg-steel grid gap-4 p-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-3">
            <p className="font-num text-sm font-bold text-orange-300">Brag</p>
            <h1 className="text-3xl md:text-5xl">운동 자랑방</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-steel-300">
              기록이 짧아도 괜찮습니다. 오늘 운동, PR 달성, 체형 변화처럼 자랑할 주제만 고르면
              초보도 빠르게 올릴 수 있게 만들었습니다.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/brag/write" className="dg-btn dg-btn-primary px-5">
                빠르게 자랑 올리기
              </Link>
              <a href="#brag-feed" className="dg-btn dg-btn-steel px-5 text-sm">
                최근 자랑 보기
              </a>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-1">
            {featuredTemplates.map((item, idx) => (
              <div
                key={item.label}
                className="dg-well dg-rise group flex items-start gap-3 p-4"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <span className="grid h-10 w-10 flex-none place-items-center rounded-md border-2 border-black bg-plate-yellow text-black shadow-sm transition-transform duration-150 group-hover:-rotate-6">
                  <TemplateIcon kind={item.icon} />
                </span>
                <div>
                  <div className="font-bold">{item.label}</div>
                  <p className="mt-1 text-sm text-steel-300">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </header>

        <div className="dg-well grid gap-4 p-4 lg:grid-cols-[0.65fr,1fr]">
          <div>
            <div className="font-display text-lg text-white">초보용 필터</div>
            <p className="mt-1 text-xs text-steel-400">친구 공개 글만 따로 보거나 운동 종목으로 바로 찾을 수 있습니다.</p>
          </div>
          <div className="space-y-3">
            <div className="relative inline-grid grid-cols-2 border-b-2 border-steel-700" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={visibilityFilter === "ALL"}
                onClick={() => setVisibilityFilter("ALL")}
                className={`px-4 pb-2 pt-1 text-sm font-bold transition-colors ${visibilityFilter === "ALL" ? "text-white" : "text-steel-400 hover:text-steel-200"}`}
              >
                전체 보기
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={visibilityFilter === "FRIENDS"}
                onClick={() => setVisibilityFilter("FRIENDS")}
                className={`px-4 pb-2 pt-1 text-sm font-bold transition-colors ${visibilityFilter === "FRIENDS" ? "text-white" : "text-steel-400 hover:text-steel-200"}`}
              >
                친구 공개만
              </button>
              <span
                aria-hidden
                className="absolute -bottom-[2px] left-0 h-1 w-1/2 bg-plate-red transition-transform duration-300 ease-out"
                style={{ transform: `translateX(${visibilityFilter === "FRIENDS" ? 100 : 0}%)` }}
              />
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="종목, 제목, 내용으로 검색"
              className="w-full rounded border-2 border-black bg-steel-900 px-4 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow"
            />
          </div>
        </div>

        {shareMessage && (
          <div className="dg-pop dg-well border-l-[6px] border-l-plate-green px-4 py-3 text-sm font-semibold text-green-200">
            {shareMessage}
          </div>
        )}

        {loading && (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={`brag-skeleton-${idx}`} className="overflow-hidden rounded-xl border-[3px] border-black bg-steel-800 shadow-md">
                <div className="grid h-56 place-items-center bg-steel-900">
                  <span className="dg-loading-plates" aria-label="불러오는 중">
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
                <div className="space-y-3 p-5">
                  <div className="h-4 w-2/5 animate-pulse rounded bg-steel-700" />
                  <div className="h-6 w-4/5 animate-pulse rounded bg-steel-700" />
                  <div className="h-4 w-full animate-pulse rounded bg-steel-700" />
                  <div className="h-4 w-3/4 animate-pulse rounded bg-steel-700" />
                </div>
              </div>
            ))}
          </div>
        )}
        {error && <p className="text-red-300">{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <div className="dg-well p-8 text-center text-steel-400">
            아직 표시할 자랑글이 없습니다. 첫 번째 자랑을 올려보세요.
          </div>
        )}

        <div id="brag-feed" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((post, idx) => {
            const cover = post.mediaUrls?.[0];
            const likeState = likes[post.id];
            const summary = extractSummary(post.content);
            const likeCount = likeState?.count ?? post.likeCount ?? 0;
            return (
              <article
                key={post.id}
                className="dg-lift dg-rise overflow-hidden rounded-xl border-[3px] border-black bg-steel-800 shadow-md"
                style={{ animationDelay: `${Math.min(idx, 12) * 50}ms` }}
              >
                {cover ? (
                  <div className="relative h-56 overflow-hidden border-b-[3px] border-black">
                    {isVideo(cover) ? (
                      <video src={withBase(cover)} className="h-full w-full object-cover" muted controls />
                    ) : (
                      <img loading="lazy" decoding="async" src={withBase(cover)} alt={post.title} className="h-full w-full object-cover" />
                    )}
                    <div className="absolute left-3 top-3 flex gap-2 text-xs">
                      {post.visibility === "FRIENDS" && (
                        <span className="dg-chip bg-plate-blue text-white">친구 공개</span>
                      )}
                      {post.movement && (
                        <span className="dg-chip bg-steel-900 text-chalk">{post.movement}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="dg-rubber flex h-40 items-end border-b-[3px] border-black p-5">
                    <div>
                      <div className="font-num text-sm font-bold text-orange-300">Workout Brag</div>
                      <div className="mt-1 text-lg font-bold">{post.movement || "오늘 운동 기록"}</div>
                    </div>
                  </div>
                )}

                <div className="space-y-4 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{post.authorNickname ?? "익명 회원"}</div>
                      <div className="text-xs text-steel-400">
                        {post.createdAt ? new Date(post.createdAt).toLocaleString("ko-KR") : ""}
                      </div>
                    </div>
                    {post.weight && (
                      <div className="dg-chip bg-plate-yellow text-base text-black">
                        {post.weight}
                      </div>
                    )}
                  </div>

                  <div>
                    <Link to={`/brag/${post.id}`} className="line-clamp-2 text-xl font-bold transition-colors hover:text-orange-300">
                      {post.title}
                    </Link>
                    <p className="mt-2 min-h-[64px] text-sm leading-relaxed text-steel-300">{summary || "운동 기록이 등록되어 있습니다."}</p>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-steel-300">
                    {post.movement && <span className="dg-chip bg-steel-700">{post.movement}</span>}
                    <span className="dg-chip bg-steel-700">좋아요 {likeCount}</span>
                    <span className="dg-chip bg-steel-700">상세 보기 가능</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => void toggleLike(post.id)}
                      aria-pressed={!!likeState?.liked}
                      className={`dg-btn dg-chalk-burst min-h-[42px] flex-1 px-3 text-sm ${
                        likeState?.liked ? "bg-plate-red text-white" : "bg-steel-700 text-steel-100"
                      }`}
                    >
                      <span key={likeState?.liked ? "on" : "off"} className="dg-pop inline-flex">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill={likeState?.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" aria-hidden>
                          <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
                        </svg>
                      </span>
                      좋아요 <span key={likeCount} className="dg-pop font-num inline-block text-base font-black">{likeCount}</span>
                    </button>
                    <button
                      onClick={() => void handleShare(post)}
                      className="dg-btn dg-btn-steel dg-chalk-burst min-h-[42px] px-4 text-sm"
                    >
                      공유
                    </button>
                    <Link to={`/brag/${post.id}`} className="dg-btn min-h-[42px] bg-chalk px-4 text-sm text-black">
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
