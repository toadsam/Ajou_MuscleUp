import { useState, useEffect } from "react";
import UploadDropzone from "../components/UploadDropzone";
import { logEvent } from "../utils/analytics";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const withBase = (url: string) => (url?.startsWith("http") ? url : `${API_BASE}${url}`);

type BragPostPayload = {
  title: string;
  content: string;
  movement?: string;
  weight?: string;
  mediaUrls: string[];
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

export default function BragWrite() {
  const [form, setForm] = useState({
    title: "",
    movement: "",
    weight: "",
    content: "",
    mediaUrls: [] as string[],
  });
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    logEvent("brag_write", "page_view");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      setErr("제목과 본문을 입력해주세요.");
      return;
    }
    if (form.mediaUrls.length > 10) {
      setErr("사진/영상은 최대 10개까지 올릴 수 있어요.");
      return;
    }
    try {
      setSubmitting(true);
      setErr(null);
      const payload: BragPostPayload = {
        title: form.title.trim(),
        content: form.content.trim(),
        movement: form.movement.trim() || undefined,
        weight: form.weight.trim() || undefined,
        mediaUrls: form.mediaUrls,
      };
      await api("/api/brags", { method: "POST", body: JSON.stringify(payload) });
      alert("자랑이 등록되었어요!");
      window.location.href = "/brag";
    } catch (e: any) {
      setErr(e?.message || "자랑을 등록하지 못했어요.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploaded = (url: string) => {
    setForm((prev) => ({ ...prev, mediaUrls: [...prev.mediaUrls, url] }));
  };

  const removeMedia = (url: string) => {
    setForm((prev) => ({ ...prev, mediaUrls: prev.mediaUrls.filter((u) => u !== url) }));
  };

  return (
    <section className="pt-32 pb-20 px-5 md:px-10 bg-gradient-to-br from-gray-900 via-black to-gray-800 min-h-screen text-white">
      <div className="max-w-4xl mx-auto bg-gray-800/70 backdrop-blur-md border border-white/5 rounded-3xl p-8 shadow-xl space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-pink-300">우리 회원 자랑방</p>
          <h1 className="text-3xl md:text-4xl font-extrabold">나의 자랑 올리기</h1>
          <p className="text-gray-300 mt-2">
            모바일에서는 카메라/갤러리에서 불러오고, PC에서는 사진·영상을 여러 개 드래그해도 손쉽게 올릴 수 있어요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-300">제목</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded-xl bg-gray-900 border border-gray-700 px-4 py-3 focus:outline-none focus:border-pink-400"
                placeholder="예) 데드리프트 150kg 갱신!"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm text-gray-300">종목</label>
                <input
                  type="text"
                  value={form.movement}
                  onChange={(e) => setForm({ ...form, movement: e.target.value })}
                  className="w-full rounded-xl bg-gray-900 border border-gray-700 px-4 py-3 focus:outline-none focus:border-pink-400"
                  placeholder="스쿼트"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-300">무게</label>
                <input
                  type="text"
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: e.target.value })}
                  className="w-full rounded-xl bg-gray-900 border border-gray-700 px-4 py-3 focus:outline-none focus:border-pink-400"
                  placeholder="예) 120kg"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-300">자세 메모 / 후기</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="w-full rounded-xl bg-gray-900 border border-gray-700 px-4 py-3 focus:outline-none focus:border-pink-400 h-28 resize-none"
              placeholder="세트 간 느낌, 다음 목표 등을 적어주세요."
              required
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm text-gray-300">사진/영상 첨부</label>
            <UploadDropzone onUploaded={handleUploaded} accept="image/*,video/*" multiple />
            {form.mediaUrls.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {form.mediaUrls.map((rawUrl) => {
                  const url = withBase(rawUrl);
                  return (
                    <div key={rawUrl} className="relative group rounded-xl overflow-hidden border border-gray-700 bg-gray-900">
                      {/\.(mp4|mov|webm|avi|mkv)(\?|$)/i.test(url.split("?")[0]) ? (
                        <video src={url} className="w-full h-28 object-cover" controls />
                      ) : (
                        <img src={url} alt="" className="w-full h-28 object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() => removeMedia(rawUrl)}
                        className="absolute top-2 right-2 bg-black/70 text-xs px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition"
                      >
                        삭제
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {form.mediaUrls.length === 0 && (
              <p className="text-sm text-gray-400">
                모바일은 카메라/갤러리에서 불러오고, PC는 여러 파일을 드래그해도 올릴 수 있어요.
              </p>
            )}
          </div>

          {err && <p className="text-sm text-red-400">{err}</p>}

          <div className="flex gap-3">
            <a
              href="/brag"
              className="px-4 py-3 rounded-xl border border-gray-600 text-sm font-semibold text-gray-200 hover:bg-gray-700 transition"
            >
              목록으로
            </a>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 to-orange-500 px-4 py-3 font-semibold hover:opacity-90 transition disabled:opacity-60"
            >
              {submitting ? "등록 중..." : "자랑 올리기"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
