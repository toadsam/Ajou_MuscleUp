import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import UploadDropzone from "../components/UploadDropzone";

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

export default function BragDetail() {
  const { id } = useParams();
  const postId = Number(id);
  const [post, setPost] = useState<BragPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [like, setLike] = useState<LikeRes>({ likeCount: 0, liked: false });
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const p = await api<BragPost>(`/api/brags/${postId}`);
      setPost(p);
      const c = await api<Comment[]>(`/api/brags/${postId}/comments`);
      setComments(c);
      const l = await api<LikeRes>(`/api/brags/${postId}/like`);
      setLike(l);
    } catch (e: any) {
      setError(e?.message || "게시글을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (!Number.isNaN(postId)) fetchData();
  }, [fetchData, postId]);

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
      alert(e?.message || "댓글을 남기지 못했어요.");
    }
  };

  const toggleLike = async () => {
    try {
      const res = await api<LikeRes>(`/api/brags/${postId}/like`, { method: "POST" });
      setLike(res);
    } catch (e: any) {
      alert(e?.message || "좋아요 처리에 실패했어요.");
    }
  };

  const handleUpload = (url: string) => {
    // optional: allow adding media in comments; currently unused but left for extension
    console.info("Uploaded", url);
  };

  if (loading) {
    return (
      <section className="pt-32 p-10 min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white">
        <div className="max-w-5xl mx-auto animate-pulse space-y-4">
          <div className="h-10 bg-gray-700/50 rounded-lg" />
          <div className="h-52 bg-gray-700/50 rounded-2xl" />
        </div>
      </section>
    );
  }

  if (error || !post) {
    return (
      <section className="pt-32 p-10 min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white">
        <div className="max-w-3xl mx-auto text-red-400">{error || "게시글을 찾을 수 없습니다."}</div>
      </section>
    );
  }

  return (
    <section className="pt-32 pb-20 px-5 md:px-10 bg-gradient-to-br from-gray-900 via-black to-gray-800 min-h-screen text-white">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <Link to="/brag" className="text-sm text-gray-300 hover:text-white underline">
            ← 목록으로
          </Link>
          <button
            onClick={toggleLike}
            className="flex items-center gap-2 rounded-full border border-pink-400/50 px-3 py-1 text-sm text-pink-200 hover:bg-pink-500/10 transition"
          >
            <span>❤️</span>
            <span>{like.likeCount}</span>
            <span className="text-xs">{like.liked ? "좋아요 취소" : "좋아요"}</span>
          </button>
        </div>

        <header className="space-y-2">
          <p className="text-sm text-pink-300 font-semibold">
            {post.authorNickname || "득근회원"} · {formatDate(post.createdAt)}
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold">{post.title}</h1>
          {(post.movement || post.weight) && (
            <div className="px-3 py-2 rounded-xl bg-gray-900 text-sm text-gray-200 border border-gray-700 inline-flex gap-1">
              {post.movement && <span className="font-semibold">{post.movement}</span>}
              {post.movement && post.weight && <span className="text-gray-500 mx-1">·</span>}
              {post.weight && <span>{post.weight}</span>}
            </div>
          )}
        </header>

        <p className="text-gray-200 leading-relaxed whitespace-pre-line">{post.content}</p>

        {post.mediaUrls?.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {post.mediaUrls.map((rawUrl) => {
              const url = withBase(rawUrl);
              return (
                <button
                  key={rawUrl}
                  onClick={() => setLightbox(url)}
                  className="group rounded-2xl overflow-hidden border border-gray-700 bg-gray-900 relative"
                >
                  {isVideo(url) ? (
                    <video src={url} className="w-full h-64 object-cover" muted />
                  ) : (
                    <img src={url} alt="" className="w-full h-64 object-cover" />
                  )}
                  <span className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition" />
                </button>
              );
            })}
          </div>
        )}

        <div id="comments" className="space-y-4 bg-gray-800/60 rounded-2xl border border-white/5 p-5">
          <h2 className="text-xl font-bold">댓글 {comments.length}</h2>
          <form onSubmit={submitComment} className="space-y-3">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="w-full rounded-xl bg-gray-900 border border-gray-700 px-4 py-3 focus:outline-none focus:border-pink-400 resize-none"
              placeholder="응원 한마디를 남겨주세요."
              required
            />
            <div className="flex justify-between items-center gap-3">
              <UploadDropzone onUploaded={handleUpload} accept="image/*,video/*" className="flex-1" />
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-pink-500 to-orange-500 px-4 py-3 font-semibold hover:opacity-90 transition"
              >
                댓글 달기
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
                <div className="flex items-center justify-between text-sm text-gray-300">
                  <span className="font-semibold">{c.authorNickname || "득근회원"}</span>
                  <span className="text-gray-500">{formatDate(c.createdAt)}</span>
                </div>
                <p className="mt-2 text-gray-200 whitespace-pre-line">{c.content}</p>
              </div>
            ))}
            {comments.length === 0 && <p className="text-gray-400 text-sm">첫 댓글을 남겨주세요.</p>}
          </div>
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
