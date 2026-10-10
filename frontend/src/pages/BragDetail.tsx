import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import html2canvas from "html2canvas";
import UploadDropzone from "../components/UploadDropzone";
import { logEvent } from "../utils/analytics";

type BragPost = {
  id: number;
  title: string;
  content: string;
  movement?: string | null;
  weight?: string | null;
  mediaUrls: string[];
  authorNickname?: string | null;
  authorEmail?: string | null;
  createdAt?: string | null;
};

type Comment = {
  id: number;
  content: string;
  authorNickname?: string | null;
  authorEmail?: string | null;
  createdAt?: string | null;
};

type LikeRes = { likeCount: number; liked: boolean };

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
  const text = await res.text();
  if (!text) return null as T;
  return JSON.parse(text) as T;
}

const defaultMeta = (): ParsedMeta => ({
  tags: [],
  beforeUrls: [],
  afterUrls: [],
});

const parseMeta = (raw: string): { cleanContent: string; meta: ParsedMeta; metaBlock: string } => {
  const match = raw.match(/---\s*META\s*([\s\S]*?)\s*---/i);
  if (!match) {
    return { cleanContent: raw.trim(), meta: defaultMeta(), metaBlock: "" };
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
  return { cleanContent, meta, metaBlock: match[0] };
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

const renderMentions = (text: string) => {
  const parts = text.split(/(@[\w가-힣]+)/g);
  return parts.map((part, index) => {
    if (part.startsWith("@")) {
      return (
        <span key={`${part}-${index}`} className="text-plate-yellow font-semibold">
          {part}
        </span>
      );
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
};

export default function BragDetail() {
  const { id } = useParams();
  const postId = Number(id);
  const [post, setPost] = useState<BragPost | null>(null);
  const [cleanContent, setCleanContent] = useState("");
  const [meta, setMeta] = useState<ParsedMeta>(defaultMeta());
  const [metaBlock, setMetaBlock] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [like, setLike] = useState<LikeRes>({ likeCount: 0, liked: false });
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingPost, setEditingPost] = useState(false);
  const [editPostForm, setEditPostForm] = useState({ title: "", content: "", movement: "", weight: "", mediaUrls: [] as string[] });
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [localReactions, setLocalReactionsState] = useState<Record<number, LocalReactions>>(getLocalReactions());
  const [blockedAuthors, setBlockedAuthorsState] = useState<string[]>(getBlockedAuthors());
  const shareCardRef = useRef<HTMLDivElement | null>(null);

  const userRaw = localStorage.getItem("user");
  const user = userRaw ? (JSON.parse(userRaw) as { email?: string; role?: string; nickname?: string }) : null;
  const isAdmin = (user?.role || "").toUpperCase().includes("ADMIN");
  const isOwner = post && user?.email && post.authorEmail === user.email;
  const shareUrl = useMemo(() => `${window.location.origin}/brag/${postId}`, [postId]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const p = await api<BragPost>(`/api/brags/${postId}`);
      setPost(p);
      const parsed = parseMeta(p.content || "");
      setCleanContent(parsed.cleanContent);
      setMeta(parsed.meta);
      setMetaBlock(parsed.metaBlock);
      setEditPostForm({
        title: p.title ?? "",
        content: parsed.cleanContent ?? "",
        movement: p.movement ?? "",
        weight: p.weight ?? "",
        mediaUrls: p.mediaUrls ?? [],
      });
      const c = await api<Comment[]>(`/api/brags/${postId}/comments`);
      setComments(c);
      const l = await api<LikeRes>(`/api/brags/${postId}/like`);
      setLike(l);
    } catch (e: any) {
      setError(e?.message || "게시글을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (!Number.isNaN(postId)) fetchData();
  }, [fetchData, postId]);

  useEffect(() => {
    logEvent("brag_detail", "page_view", { postId });
  }, [postId]);

  useEffect(() => {
    if (!shareFeedback) return;
    const timer = window.setTimeout(() => setShareFeedback(null), 2200);
    return () => window.clearTimeout(timer);
  }, [shareFeedback]);

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      const created = await api<Comment>(`/api/brags/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: commentText.trim() }),
      });
      setComments((prev) => [...prev, created]);
      setCommentText("");
    } catch (e: any) {
      alert(e?.message || "댓글을 등록하지 못했습니다.");
    }
  };

  const toggleLike = async () => {
    try {
      const res = await api<LikeRes>(`/api/brags/${postId}/like`, { method: "POST" });
      setLike(res);
    } catch (e: any) {
      alert(e?.message || "응원 처리에 실패했습니다.");
    }
  };

  const handleUpload = (url: string) => {
    setEditPostForm((prev) => ({ ...prev, mediaUrls: [...prev.mediaUrls, url] }));
  };

  const removeMedia = (url: string) => {
    setEditPostForm((prev) => ({ ...prev, mediaUrls: prev.mediaUrls.filter((u) => u !== url) }));
  };

  const toggleLocalReaction = (key: keyof LocalReactions) => {
    const next = { ...localReactions, [postId]: { ...localReactions[postId], [key]: !localReactions[postId]?.[key] } };
    setLocalReactionsState(next);
    setLocalReactions(next);
  };

  const toggleBlock = (email?: string | null) => {
    if (!email) return;
    const next = blockedAuthors.includes(email)
      ? blockedAuthors.filter((value) => value !== email)
      : [...blockedAuthors, email];
    setBlockedAuthorsState(next);
    setBlockedAuthors(next);
  };

  const submitReport = async () => {
    if (!post || !reportText.trim()) return;
    try {
      await api("/api/support/inquiries", {
        method: "POST",
        body: JSON.stringify({
          name: user?.nickname || "익명",
          email: user?.email || "",
          message: `자랑방 신고\n게시글: ${post.title}\n사유: ${reportText.trim()}`,
          page: `/brag/${postId}`,
        }),
      });
      alert("신고가 접수되었습니다.");
      setReportOpen(false);
      setReportText("");
    } catch (e: any) {
      alert(e?.message || "신고 접수에 실패했습니다.");
    }
  };

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareFeedback("공유 링크를 복사했습니다.");
    } catch {
      setShareFeedback("링크 복사에 실패했습니다.");
    }
  };

  const handleNativeShare = async () => {
    try {
      if (!navigator.share) {
        await handleCopyShareLink();
        return;
      }
      await navigator.share({
        title: post?.title ?? "운동 자랑",
        text: cleanContent || post?.title || "운동 자랑 기록",
        url: shareUrl,
      });
    } catch {
      // user cancelled or browser blocked
    }
  };

  const handleSaveShareCard = async () => {
    const node = shareCardRef.current;
    if (!node || !post) return;
    try {
      const canvas = await html2canvas(node, {
        backgroundColor: "#26272B",
        scale: Math.min(window.devicePixelRatio || 1, 2),
      });
      const link = document.createElement("a");
      link.download = `brag-${post.id}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      setShareFeedback("공유 카드 이미지를 저장했습니다.");
    } catch {
      setShareFeedback("공유 카드 저장에 실패했습니다.");
    }
  };

  const local = localReactions[postId] || {};

  if (loading) {
    return (
      <section className="pt-32 p-10 min-h-screen text-white">
        <div className="max-w-5xl mx-auto space-y-4">
          <span className="dg-loading-plates" aria-label="불러오는 중">
            <i />
            <i />
            <i />
            <i />
          </span>
          <div className="h-10 animate-pulse rounded-lg bg-steel-800" />
          <div className="h-52 animate-pulse rounded-xl border-[3px] border-black bg-steel-800" />
        </div>
      </section>
    );
  }

  if (error || !post) {
    return (
      <section className="pt-32 p-10 min-h-screen text-white">
        <div className="max-w-3xl mx-auto text-red-300">{error || "게시글을 찾을 수 없습니다."}</div>
      </section>
    );
  }

  if (post.authorEmail && blockedAuthors.includes(post.authorEmail)) {
    return (
      <section className="pt-32 p-10 min-h-screen text-white">
        <div className="dg-steel max-w-3xl mx-auto p-8 text-center space-y-4">
          <p className="text-steel-300">차단한 작성자의 게시글입니다.</p>
          <button
            className="dg-btn dg-btn-steel mx-auto flex"
            onClick={() => toggleBlock(post.authorEmail)}
          >
            차단 해제
          </button>
          <Link to="/brag" className="text-sm text-steel-300 underline">
            목록으로
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="pt-28 pb-20 px-5 md:px-10 min-h-screen text-white">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/brag" className="dg-btn dg-btn-steel min-h-[36px] px-3 text-sm">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
            목록으로
          </Link>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={() => void handleNativeShare()}
              className="dg-btn dg-btn-steel min-h-[34px] px-3 text-xs dg-chalk-burst"
            >
              공유하기
            </button>
            <button
              onClick={() => void handleCopyShareLink()}
              className="dg-btn dg-btn-steel min-h-[34px] px-3 text-xs dg-chalk-burst"
            >
              링크 복사
            </button>
            <button
              onClick={() => void handleSaveShareCard()}
              className="dg-btn dg-btn-steel min-h-[34px] px-3 text-xs"
            >
              카드 저장
            </button>
            <button
              onClick={toggleLike}
              aria-pressed={like.liked}
              className={`dg-btn dg-chalk-burst min-h-[34px] px-3 text-xs ${like.liked ? "bg-plate-red text-white" : "bg-steel-700 text-chalk"}`}
            >
              <span key={like.liked ? "on" : "off"} className="dg-pop inline-flex">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill={like.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2.6} strokeLinejoin="round" aria-hidden>
                  <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
                </svg>
              </span>
              응원 <span key={like.likeCount} className="dg-pop font-num inline-block text-sm font-black">{like.likeCount}</span>
            </button>
            <button
              onClick={() => toggleLocalReaction("inspire")}
              aria-pressed={!!local.inspire}
              className={`dg-btn dg-chalk-burst min-h-[34px] px-3 text-xs ${
                local.inspire ? "dg-pop bg-plate-green text-white" : "bg-steel-700 text-steel-200"
              }`}
            >
              자극됨
            </button>
            <button
              onClick={() => toggleLocalReaction("helpful")}
              aria-pressed={!!local.helpful}
              className={`dg-btn dg-chalk-burst min-h-[34px] px-3 text-xs ${
                local.helpful ? "dg-pop bg-plate-blue text-white" : "bg-steel-700 text-steel-200"
              }`}
            >
              도움됨
            </button>
            <button
              onClick={() => toggleBlock(post.authorEmail)}
              className="dg-btn min-h-[34px] bg-steel-900 px-3 text-xs text-steel-400"
            >
              차단
            </button>
            <button
              onClick={() => setReportOpen(true)}
              className="dg-btn min-h-[34px] bg-steel-900 px-3 text-xs text-red-300"
            >
              신고
            </button>
          </div>
        </div>

        {shareFeedback && (
          <div className="dg-pop dg-well border-l-[6px] border-l-plate-green px-4 py-3 text-sm font-semibold text-green-200">
            {shareFeedback}
          </div>
        )}

        <header className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-orange-300 font-semibold">
              {post.authorNickname || "익명 회원"} · {formatDate(post.createdAt)}
            </p>
            {(isOwner || isAdmin) && (
              <div className="flex gap-2 text-xs">
                <button
                  onClick={() => setEditingPost((v) => !v)}
                  className="dg-btn dg-btn-steel min-h-[34px] px-3 text-xs"
                >
                  {editingPost ? "수정 취소" : "수정"}
                </button>
                <button
                  onClick={async () => {
                    if (!confirm("이 게시글을 삭제할까요?")) return;
                    try {
                      await api(`/api/brags/${postId}`, { method: "DELETE" });
                      alert("삭제했습니다.");
                      window.location.href = "/brag";
                    } catch (e: any) {
                      alert(e?.message || "삭제에 실패했습니다.");
                    }
                  }}
                  className="dg-btn min-h-[34px] bg-steel-900 px-3 text-xs text-red-300 hover:bg-plate-red hover:text-white"
                >
                  삭제
                </button>
              </div>
            )}
          </div>

          {editingPost ? (
            <div className="space-y-3">
              <input
                value={editPostForm.title}
                onChange={(e) => setEditPostForm((p) => ({ ...p, title: e.target.value }))}
                className="dg-well w-full px-4 py-3 text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow"
              />
              <div className="flex gap-3">
                <input
                  value={editPostForm.movement}
                  onChange={(e) => setEditPostForm((p) => ({ ...p, movement: e.target.value }))}
                  placeholder="종목"
                  className="dg-well w-full px-4 py-3 text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow flex-1"
                />
                <input
                  value={editPostForm.weight}
                  onChange={(e) => setEditPostForm((p) => ({ ...p, weight: e.target.value }))}
                  placeholder="무게"
                  className="dg-well w-full px-4 py-3 text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow flex-1"
                />
              </div>
              <textarea
                value={editPostForm.content}
                onChange={(e) => setEditPostForm((p) => ({ ...p, content: e.target.value }))}
                rows={5}
                className="dg-well w-full px-4 py-3 text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow"
              />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-steel-200">사진/영상 첨부</span>
                  <span className="font-num text-sm font-bold text-steel-400">{editPostForm.mediaUrls.length}/10</span>
                </div>
                <UploadDropzone onUploaded={handleUpload} accept="image/*,video/*" multiple folder="brag" />
                {editPostForm.mediaUrls.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    {editPostForm.mediaUrls.map((rawUrl) => {
                      const url = withBase(rawUrl);
                      return (
                        <div key={rawUrl} className="dg-pop relative overflow-hidden rounded-md border-2 border-black bg-steel-900">
                          {isVideo(url) ? (
                            <video src={url} className="w-full h-28 object-cover" controls />
                          ) : (
                            <img loading="lazy" decoding="async" src={url} alt="" className="w-full h-28 object-cover" />
                          )}
                          <button
                            type="button"
                            onClick={() => removeMedia(rawUrl)}
                            className="absolute top-2 right-2 rounded border-2 border-black bg-steel-900 px-2 py-0.5 text-xs font-bold text-red-300 hover:bg-plate-red hover:text-white"
                          >
                            삭제
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  className="dg-btn dg-btn-steel min-h-[40px] px-4 text-sm"
                  onClick={() => setEditingPost(false)}
                  type="button"
                >
                  취소
                </button>
                <button
                  className="dg-btn dg-btn-primary min-h-[40px] px-4 text-sm"
                  type="button"
                  onClick={async () => {
                    try {
                      const payload = {
                        title: editPostForm.title.trim(),
                        content: `${editPostForm.content.trim()}${metaBlock ? `\n\n${metaBlock}` : ""}`,
                        movement: editPostForm.movement.trim() || null,
                        weight: editPostForm.weight.trim() || null,
                        mediaUrls: editPostForm.mediaUrls,
                      };
                      await api(`/api/brags/${postId}`, {
                        method: "PUT",
                        body: JSON.stringify(payload),
                      });
                      alert("수정했습니다.");
                      setEditingPost(false);
                      fetchData();
                    } catch (e: any) {
                      alert(e?.message || "수정에 실패했습니다.");
                    }
                  }}
                >
                  저장
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="dg-rise text-3xl md:text-4xl">{post.title}</h1>
              <div className="flex flex-wrap gap-2 text-xs">
                {meta.region && (
                  <span className="dg-chip bg-plate-green text-white">{meta.region}</span>
                )}
                {meta.gym && (
                  <span className="dg-chip bg-orange-500 text-black">{meta.gym}</span>
                )}
                {post.mediaUrls?.length ? (
                  <span className="dg-chip bg-plate-yellow text-black">인증</span>
                ) : null}
                {meta.tags.map((tag) => (
                  <span key={tag} className="dg-chip bg-steel-700 text-steel-200">
                    #{tag}
                  </span>
                ))}
              </div>
            </>
          )}
        </header>

        {!editingPost && <p className="text-steel-100 leading-relaxed whitespace-pre-line">{cleanContent}</p>}

        <div
          ref={shareCardRef}
          className="dg-steel overflow-hidden"
        >
          <div className="grid gap-4 p-6 md:grid-cols-[1fr,0.9fr]">
            <div className="space-y-4">
              <div className="font-num text-sm font-bold text-orange-300">Workout Brag</div>
              <h2 className="font-display text-2xl text-white">{post.title}</h2>
              <p className="text-sm text-steel-300">{cleanContent.slice(0, 140) || "오늘의 운동 기록을 공유합니다."}</p>
              <div className="flex flex-wrap gap-2 text-xs text-chalk">
                <span className="dg-chip bg-steel-700">{post.authorNickname || "익명 회원"}</span>
                {post.movement && <span className="dg-chip bg-steel-700">{post.movement}</span>}
                {post.weight && <span className="dg-chip bg-plate-yellow text-black">{post.weight}</span>}
                {meta.duration && <span className="dg-chip bg-steel-700">{meta.duration}</span>}
              </div>
              <div className="font-num text-sm text-steel-400">{shareUrl}</div>
            </div>
            <div className="overflow-hidden rounded-md border-[3px] border-black bg-steel-900">
              {post.mediaUrls?.[0] ? (
                isVideo(withBase(post.mediaUrls[0])) ? (
                  <div className="flex min-h-[220px] items-center justify-center text-sm text-steel-400">
                    영상이 포함된 자랑글입니다
                  </div>
                ) : (
                  <img loading="lazy" decoding="async" src={withBase(post.mediaUrls[0])} alt={post.title} className="h-full min-h-[220px] w-full object-cover" />
                )
              ) : (
                <div className="flex min-h-[220px] items-center justify-center text-sm text-steel-400">
                  대표 미디어 없이도 공유할 수 있습니다
                </div>
              )}
            </div>
          </div>
        </div>

        {(post.movement || post.weight || meta.duration || meta.routine || meta.mood) && (
          <div className="dg-steel p-6 grid gap-4 md:grid-cols-2">
            <div className="dg-well p-4 space-y-2">
              <p className="text-xs text-steel-400">운동 기록</p>
              <p className="text-lg font-bold">{post.movement || "운동"}</p>
              <p className="font-num text-base font-bold text-plate-yellow">
                {post.weight ? `무게 ${post.weight}` : ""}
                {post.weight && meta.duration ? " · " : ""}
                {meta.duration ? `시간 ${meta.duration}` : ""}
              </p>
            </div>
            <div className="dg-well p-4 space-y-2">
              <p className="text-xs text-steel-400">오늘의 컨디션</p>
              <p className="text-sm text-steel-100">{meta.mood || "기분 기록 없음"}</p>
            </div>
            {meta.routine && (
              <div className="dg-well p-4 space-y-2 md:col-span-2">
                <p className="text-xs text-steel-400">루틴 요약</p>
                <p className="text-sm text-steel-100 whitespace-pre-line">{meta.routine}</p>
              </div>
            )}
            {meta.tips && (
              <div className="dg-well p-4 space-y-2">
                <p className="text-xs text-steel-400">오늘의 팁</p>
                <p className="text-sm text-steel-100 whitespace-pre-line">{meta.tips}</p>
              </div>
            )}
            {meta.nextGoal && (
              <div className="dg-well p-4 space-y-2">
                <p className="text-xs text-steel-400">다음 목표</p>
                <p className="text-sm text-steel-100 whitespace-pre-line">{meta.nextGoal}</p>
              </div>
            )}
          </div>
        )}

        {meta.beforeUrls.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-num text-2xl font-black text-steel-300">Before</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {meta.beforeUrls.map((rawUrl) => {
                const url = withBase(rawUrl);
                return (
                  <button
                    key={`before-${rawUrl}`}
                    onClick={() => setLightbox(url)}
                    className="dg-lift group overflow-hidden rounded-xl border-[3px] border-black bg-steel-900 shadow-md"
                  >
                    {isVideo(url) ? (
                      <video src={url} className="w-full h-60 object-cover" muted />
                    ) : (
                      <img loading="lazy" decoding="async" src={url} alt="before" className="w-full h-60 object-cover" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {meta.afterUrls.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-num text-2xl font-black text-plate-yellow">After</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {meta.afterUrls.map((rawUrl) => {
                const url = withBase(rawUrl);
                return (
                  <button
                    key={`after-${rawUrl}`}
                    onClick={() => setLightbox(url)}
                    className="dg-lift group overflow-hidden rounded-xl border-[3px] border-black bg-steel-900 shadow-md"
                  >
                    {isVideo(url) ? (
                      <video src={url} className="w-full h-60 object-cover" muted />
                    ) : (
                      <img loading="lazy" decoding="async" src={url} alt="after" className="w-full h-60 object-cover" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {post.mediaUrls?.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {post.mediaUrls.map((rawUrl) => {
              const url = withBase(rawUrl);
              return (
                <button
                  key={rawUrl}
                  onClick={() => setLightbox(url)}
                  className="dg-lift group overflow-hidden rounded-xl border-[3px] border-black bg-steel-900 shadow-md"
                >
                  {isVideo(url) ? (
                    <video src={url} className="w-full h-64 object-cover" muted />
                  ) : (
                    <img loading="lazy" decoding="async" src={url} alt="media" className="w-full h-64 object-cover" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div id="comments" className="dg-steel space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl">댓글 <span key={comments.length} className="dg-pop font-num inline-block text-plate-yellow">{comments.length}</span></h2>
            <div className="flex gap-2 text-xs">
              {["??", "??", "??", "??", "?"].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setCommentText((prev) => `${prev}${emoji}`)}
                  className="dg-btn dg-btn-steel min-h-[30px] px-2.5 text-xs"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={submitComment} className="space-y-3">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="dg-well w-full px-4 py-3 text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow resize-none"
              placeholder="응원 한마디를 남겨주세요. @닉네임으로 멘션할 수 있어요."
              required
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-steel-400">멘션 예시: @친구</span>
              <button
                type="submit"
                className="dg-btn dg-btn-primary px-4"
              >
                댓글 남기기
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {comments.map((c) => {
              const mine = c.authorEmail && user?.email === c.authorEmail;
              return (
                <div key={c.id} className={`dg-well dg-rise p-4 ${mine ? "border-l-[6px] border-l-plate-yellow" : ""}`}>
                  <div className="flex items-center justify-between text-sm text-steel-300">
                    <span className="font-semibold">{c.authorNickname || "익명 회원"}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-steel-500">{formatDate(c.createdAt)}</span>
                      <button
                        className="text-xs font-semibold text-orange-300 hover:text-orange-200"
                        onClick={() => setCommentText((prev) => `${prev ? `${prev}\n` : ""}@${c.authorNickname || "회원"} `)}
                      >
                        답글
                      </button>
                      {(mine || isAdmin) && (
                        <>
                          <button
                            className="text-xs font-semibold text-steel-300 hover:text-white"
                            onClick={() => {
                              setEditingCommentId(c.id);
                              setEditingCommentText(c.content);
                            }}
                          >
                            수정
                          </button>
                          <button
                            className="text-xs font-semibold text-red-300 hover:text-red-200"
                            onClick={async () => {
                              if (!confirm("이 댓글을 삭제할까요?")) return;
                              try {
                                await api(`/api/brags/comments/${c.id}`, { method: "DELETE" });
                                setComments((prev) => prev.filter((cc) => cc.id !== c.id));
                              } catch (e: any) {
                                alert(e?.message || "삭제에 실패했습니다.");
                              }
                            }}
                          >
                            삭제
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {editingCommentId === c.id ? (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={editingCommentText}
                        onChange={(e) => setEditingCommentText(e.target.value)}
                        className="w-full rounded border-2 border-black bg-steel-900 px-3 py-2 text-sm text-white focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow"
                      />
                      <div className="flex gap-2 justify-end text-xs">
                        <button
                          className="dg-btn dg-btn-steel min-h-[34px] px-3 text-xs"
                          onClick={() => setEditingCommentId(null)}
                        >
                          취소
                        </button>
                        <button
                          className="dg-btn dg-btn-primary min-h-[34px] px-3 text-xs"
                          onClick={async () => {
                            try {
                              const updated = await api<Comment>(`/api/brags/comments/${c.id}`, {
                                method: "PATCH",
                                body: JSON.stringify({ content: editingCommentText.trim() }),
                              });
                              setComments((prev) => prev.map((cc) => (cc.id === c.id ? updated : cc)));
                              setEditingCommentId(null);
                            } catch (e: any) {
                              alert(e?.message || "수정에 실패했습니다.");
                            }
                          }}
                        >
                          저장
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-steel-100 whitespace-pre-line">{renderMentions(c.content)}</p>
                  )}
                </div>
              );
            })}
            {comments.length === 0 && <p className="text-steel-400 text-sm">첫 댓글을 남겨주세요.</p>}
          </div>
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-5xl w-full flex justify-center">
            {isVideo(lightbox) ? (
              <video src={lightbox} controls autoPlay className="max-h-[90vh] max-w-[90vw]" />
            ) : (
              <img src={lightbox} className="dg-pop max-h-[90vh] max-w-[90vw] rounded-md border-[3px] border-black" alt="lightbox" />
            )}
            <button
              className="dg-btn dg-btn-steel absolute -top-3 -right-3 min-h-[36px] px-3 text-sm"
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

      {reportOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="dg-steel dg-pop w-full max-w-md p-6 space-y-4">
            <h3 className="font-display text-xl">게시글 신고</h3>
            <textarea
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              className="dg-well w-full px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow"
              placeholder="신고 사유를 적어주세요"
            />
            <div className="flex justify-end gap-2">
              <button
                className="dg-btn dg-btn-steel min-h-[40px] px-4"
                onClick={() => setReportOpen(false)}
              >
                취소
              </button>
              <button
                className="dg-btn dg-btn-primary min-h-[40px] px-4"
                onClick={submitReport}
              >
                신고하기
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
