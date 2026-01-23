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

type ParsedMeta = {
  tags: string[];
  region?: string;
  gym?: string;
  routine?: string;
  mood?: string;
  tips?: string;
  nextGoal?: string;
  duration?: string;
  beforeUrls: string[];
  afterUrls: string[];
};

type ParsedPost = BragPost & {
  cleanContent: string;
  meta: ParsedMeta;
};

type LocalReactions = {
  inspire?: boolean;
  helpful?: boolean;
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

const defaultMeta = (): ParsedMeta => ({
  tags: [],
  beforeUrls: [],
  afterUrls: [],
});

const parseMeta = (raw: string): { cleanContent: string; meta: ParsedMeta } => {
  const match = raw.match(/---\s*META\s*([\s\S]*?)\s*---/i);
  if (!match) {
    return { cleanContent: raw.trim(), meta: defaultMeta() };
  }
  const body = match[1] || "";
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const meta: ParsedMeta = defaultMeta();
  lines.forEach((line) => {
    const [keyRaw, ...rest] = line.split(":");
    const key = keyRaw.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (!value) return;
    if (key === "tags") {
      meta.tags = value
        .split(/[#,]/)
        .map((tag) => tag.replace("#", "").trim())
        .filter(Boolean);
      return;
    }
    if (key === "region") meta.region = value;
    if (key === "gym") meta.gym = value;
    if (key === "routine") meta.routine = value;
    if (key === "mood") meta.mood = value;
    if (key === "tips") meta.tips = value;
    if (key === "nextgoal") meta.nextGoal = value;
    if (key === "duration") meta.duration = value;
    if (key === "before") {
      meta.beforeUrls = value
        .split(/[|,]/)
        .map((v) => v.trim())
        .filter(Boolean);
    }
    if (key === "after") {
      meta.afterUrls = value
        .split(/[|,]/)
        .map((v) => v.trim())
        .filter(Boolean);
    }
  });

  const cleanContent = raw.replace(match[0], "").trim();
  return { cleanContent, meta };
};

const getBlockedAuthors = () => {
  try {
    return JSON.parse(localStorage.getItem("brag_blocked_authors") || "[]") as string[];
  } catch {
    return [];
  }
};

const setBlockedAuthors = (list: string[]) => {
  localStorage.setItem("brag_blocked_authors", JSON.stringify(list));
};

const getLocalReactions = () => {
  try {
    return JSON.parse(localStorage.getItem("brag_reactions") || "{}") as Record<number, LocalReactions>;
  } catch {
    return {};
  }
};

const setLocalReactions = (data: Record<number, LocalReactions>) => {
  localStorage.setItem("brag_reactions", JSON.stringify(data));
};

export default function BragList() {
  const [posts, setPosts] = useState<BragPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [likes, setLikes] = useState<Record<number, { count: number; liked: boolean }>>({});
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState("전체 지역");
  const [gymFilter, setGymFilter] = useState("전체 헬스장");
  const [sortBy, setSortBy] = useState("recent");
  const [blockedAuthors, setBlockedAuthorsState] = useState<string[]>(getBlockedAuthors());
  const [localReactions, setLocalReactionsState] = useState<Record<number, LocalReactions>>(getLocalReactions());

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api<PageResponse<BragPost>>("/api/brags");
      const items = Array.isArray(data) ? data : data.content ?? [];
      setPosts(items);
    } catch (e: any) {
      setError(e?.message || "자랑 목록을 불러오지 못했습니다.");
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
      alert(e?.message || "응원 처리에 실패했습니다.");
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    logEvent("brag_list", "page_view");
  }, []);

  const parsedPosts = useMemo<ParsedPost[]>(() => {
    return posts.map((post) => {
      const { cleanContent, meta } = parseMeta(post.content || "");
      return { ...post, cleanContent, meta };
    });
  }, [posts]);

  const tagOptions = useMemo(() => {
    const tagSet = new Set<string>();
    parsedPosts.forEach((post) => post.meta.tags.forEach((tag) => tagSet.add(tag)));
    return ["전체", ...Array.from(tagSet).sort()];
  }, [parsedPosts]);

  const regionOptions = useMemo(() => {
    const regionSet = new Set<string>();
    parsedPosts.forEach((post) => {
      if (post.meta.region) regionSet.add(post.meta.region);
    });
    return ["전체 지역", ...Array.from(regionSet).sort()];
  }, [parsedPosts]);

  const gymOptions = useMemo(() => {
    const gymSet = new Set<string>();
    parsedPosts.forEach((post) => {
      if (post.meta.gym) gymSet.add(post.meta.gym);
    });
    return ["전체 헬스장", ...Array.from(gymSet).sort()];
  }, [parsedPosts]);

  const filteredPosts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return parsedPosts
      .filter((post) => (post.authorEmail ? !blockedAuthors.includes(post.authorEmail) : true))
      .filter((post) => {
        if (selectedTag && selectedTag !== "전체" && !post.meta.tags.includes(selectedTag)) return false;
        if (regionFilter !== "전체 지역" && post.meta.region !== regionFilter) return false;
        if (gymFilter !== "전체 헬스장" && post.meta.gym !== gymFilter) return false;
        if (!keyword) return true;
        return (
          post.title.toLowerCase().includes(keyword) ||
          post.cleanContent.toLowerCase().includes(keyword) ||
          (post.movement || "").toLowerCase().includes(keyword) ||
          (post.meta.tags || []).some((tag) => tag.toLowerCase().includes(keyword))
        );
      })
      .sort((a, b) => {
        if (sortBy === "popular") return (b.likeCount ?? 0) - (a.likeCount ?? 0);
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bt - at;
      });
  }, [parsedPosts, blockedAuthors, selectedTag, regionFilter, gymFilter, search, sortBy]);

  const bestPosts = useMemo(() => {
    return [...parsedPosts]
      .sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0))
      .slice(0, 3);
  }, [parsedPosts]);

  const todayPosts = useMemo(() => {
    const now = Date.now();
    return parsedPosts
      .filter((post) => {
        if (!post.createdAt) return false;
        const diff = now - new Date(post.createdAt).getTime();
        return diff >= 0 && diff <= 1000 * 60 * 60 * 24;
      })
      .slice(0, 3);
  }, [parsedPosts]);

  const toggleBlock = (email?: string | null) => {
    if (!email) return;
    const next = blockedAuthors.includes(email)
      ? blockedAuthors.filter((value) => value !== email)
      : [...blockedAuthors, email];
    setBlockedAuthorsState(next);
    setBlockedAuthors(next);
  };

  const toggleLocalReaction = (postId: number, key: keyof LocalReactions) => {
    const next = { ...localReactions, [postId]: { ...localReactions[postId], [key]: !localReactions[postId]?.[key] } };
    setLocalReactionsState(next);
    setLocalReactions(next);
  };

  return (
    <section className="relative pt-28 pb-20 px-5 md:px-10 bg-gradient-to-br from-[#0f1118] via-[#151a29] to-[#0a0c12] min-h-screen text-white overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,122,80,0.15),_transparent_55%)]" />
      <div className="absolute -top-16 right-0 w-80 h-80 bg-orange-400/20 blur-[120px]" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-400/10 blur-[120px]" />

      <div className="relative max-w-6xl mx-auto space-y-10">
        <header className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.4em] text-orange-200">Brag & Move</p>
            <h1 className="text-3xl md:text-5xl font-extrabold">오늘의 성취를 기록하는 자랑방</h1>
            <p className="text-sm text-white/60">운동 인증, 루틴 공유, 응원까지 한 번에 모여요.</p>
          </div>
          <Link
            to="/brag/write"
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 font-semibold shadow-lg shadow-orange-500/20 hover:brightness-110 transition"
          >
            자랑 올리기
          </Link>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="glass-panel p-5 space-y-4">
            <h2 className="text-lg font-semibold">오늘의 자랑</h2>
            {todayPosts.length === 0 && <p className="text-sm text-white/50">오늘 올라온 자랑이 없습니다.</p>}
            <div className="grid gap-3 sm:grid-cols-3">
              {todayPosts.map((post) => (
                <Link
                  key={`today-${post.id}`}
                  to={`/brag/${post.id}`}
                  className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-2 hover:border-white/20 transition"
                >
                  <p className="text-xs text-orange-200">{post.meta.tags[0] || "오늘의 기록"}</p>
                  <p className="font-semibold line-clamp-2">{post.title}</p>
                  <p className="text-xs text-white/50">{formatDate(post.createdAt)}</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="glass-panel p-5 space-y-4">
            <h2 className="text-lg font-semibold">주간 베스트</h2>
            <div className="space-y-3">
              {bestPosts.map((post) => (
                <Link
                  key={`best-${post.id}`}
                  to={`/brag/${post.id}`}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-4 hover:border-white/20 transition"
                >
                  <div>
                    <p className="text-xs text-white/50">{post.authorNickname || "익명"}</p>
                    <p className="font-semibold">{post.title}</p>
                  </div>
                  <span className="text-sm text-orange-200">응원 {post.likeCount ?? 0}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="glass-panel p-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.3em] text-white/50">Search</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-white/30"
                placeholder="제목, 태그, 내용 검색"
              />
            </div>
            <div className="flex flex-wrap items-end gap-3 text-sm">
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="rounded-2xl bg-black/40 border border-white/10 px-3 py-2"
              >
                {regionOptions.map((region) => (
                  <option key={region} value={region} className="bg-[#0f1118]">
                    {region}
                  </option>
                ))}
              </select>
              <select
                value={gymFilter}
                onChange={(e) => setGymFilter(e.target.value)}
                className="rounded-2xl bg-black/40 border border-white/10 px-3 py-2"
              >
                {gymOptions.map((gym) => (
                  <option key={gym} value={gym} className="bg-[#0f1118]">
                    {gym}
                  </option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-2xl bg-black/40 border border-white/10 px-3 py-2"
              >
                <option value="recent" className="bg-[#0f1118]">최근순</option>
                <option value="popular" className="bg-[#0f1118]">응원순</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {tagOptions.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(tag === "전체" ? null : tag)}
                className={`px-3 py-1 rounded-full text-xs border transition ${
                  (selectedTag === null && tag === "전체") || selectedTag === tag
                    ? "border-orange-400 bg-orange-500/20 text-orange-200"
                    : "border-white/10 text-white/60 hover:border-white/30"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl bg-white/5 h-28" />
            ))}
          </div>
        )}

        {error && <p className="text-red-400">{error}</p>}

        {!loading && filteredPosts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-10 text-center text-white/60">
            아직 자랑이 없습니다. 첫 번째 기록을 남겨보세요.
          </div>
        )}

        <div className="space-y-4">
          {filteredPosts.map((post) => {
            const cover = post.mediaUrls?.[0];
            const local = localReactions[post.id] || {};
            return (
              <article
                key={post.id}
                className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-lg"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-orange-200 font-semibold">{post.authorNickname || "익명 회원"}</p>
                    <p className="text-xs text-white/50">{formatDate(post.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {post.meta.region && (
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-200">
                        {post.meta.region}
                      </span>
                    )}
                    {post.meta.gym && (
                      <span className="px-3 py-1 rounded-full bg-orange-500/20 text-orange-200">
                        {post.meta.gym}
                      </span>
                    )}
                    {post.mediaUrls?.length ? (
                      <span className="px-3 py-1 rounded-full bg-white/10 text-white/70">인증</span>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 mt-4 md:grid-cols-[0.9fr_1.1fr]">
                  <div className="space-y-3">
                    <Link to={`/brag/${post.id}`} className="block text-xl font-bold hover:text-orange-200 transition">
                      {post.title}
                    </Link>
                    <p className="text-sm text-white/80 leading-relaxed line-clamp-3">{post.cleanContent}</p>
                    {(post.movement || post.weight) && (
                      <div className="inline-flex gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs">
                        {post.movement && <span className="font-semibold">{post.movement}</span>}
                        {post.weight && <span>{post.weight}</span>}
                        {post.meta.duration && <span>{post.meta.duration}</span>}
                      </div>
                    )}
                    {post.meta.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {post.meta.tags.map((tag) => (
                          <button
                            key={`${post.id}-${tag}`}
                            type="button"
                            onClick={() => setSelectedTag(tag)}
                            className="text-xs px-3 py-1 rounded-full border border-white/10 text-white/60 hover:border-white/30"
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    {cover && (
                      <button
                        onClick={() => setLightbox(withBase(cover))}
                        className="rounded-2xl overflow-hidden border border-white/10 bg-black/30 w-full"
                      >
                        {isVideo(cover) ? (
                          <video src={withBase(cover)} className="w-full h-40 object-cover" muted />
                        ) : (
                          <img src={withBase(cover)} alt="cover" className="w-full h-40 object-cover" />
                        )}
                      </button>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs">
                      <button
                        onClick={() => toggleLike(post.id)}
                        className="flex items-center gap-2 rounded-full border border-orange-400/50 px-3 py-1 text-orange-200 hover:bg-orange-500/10 transition"
                      >
                        응원 {likes[post.id]?.count ?? post.likeCount ?? 0}
                      </button>
                      <button
                        onClick={() => toggleLocalReaction(post.id, "inspire")}
                        className={`rounded-full border px-3 py-1 transition ${
                          local.inspire
                            ? "border-emerald-300 bg-emerald-500/20 text-emerald-200"
                            : "border-white/10 text-white/60 hover:border-white/30"
                        }`}
                      >
                        자극됨
                      </button>
                      <button
                        onClick={() => toggleLocalReaction(post.id, "helpful")}
                        className={`rounded-full border px-3 py-1 transition ${
                          local.helpful
                            ? "border-sky-300 bg-sky-500/20 text-sky-200"
                            : "border-white/10 text-white/60 hover:border-white/30"
                        }`}
                      >
                        도움됨
                      </button>
                      <button
                        onClick={() => toggleBlock(post.authorEmail)}
                        className="rounded-full border border-white/10 px-3 py-1 text-white/50 hover:border-white/30"
                      >
                        {post.authorEmail && blockedAuthors.includes(post.authorEmail) ? "차단 해제" : "차단"}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
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
              <img src={lightbox} className="max-h-[90vh] max-w-[90vw]" alt="lightbox" />
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
