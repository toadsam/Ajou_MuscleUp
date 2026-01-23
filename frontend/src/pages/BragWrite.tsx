import { useEffect, useMemo, useState } from "react";
import UploadDropzone from "../components/UploadDropzone";
import { logEvent } from "../utils/analytics";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const withBase = (url: string) => (url?.startsWith("http") ? url : `${API_BASE}${url}`);

const DRAFT_KEY = "brag_write_draft_v1";

type BragPostPayload = {
  title: string;
  content: string;
  movement?: string;
  weight?: string;
  mediaUrls: string[];
};

type MediaItem = {
  url: string;
  kind: "normal" | "before" | "after";
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

const buildMetaBlock = (meta: {
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
}) => {
  const lines: string[] = [];
  if (meta.tags.length) lines.push(`tags: ${meta.tags.join(", ")}`);
  if (meta.region) lines.push(`region: ${meta.region}`);
  if (meta.gym) lines.push(`gym: ${meta.gym}`);
  if (meta.duration) lines.push(`duration: ${meta.duration}`);
  if (meta.routine) lines.push(`routine: ${meta.routine}`);
  if (meta.mood) lines.push(`mood: ${meta.mood}`);
  if (meta.tips) lines.push(`tips: ${meta.tips}`);
  if (meta.nextGoal) lines.push(`nextGoal: ${meta.nextGoal}`);
  if (meta.beforeUrls.length) lines.push(`before: ${meta.beforeUrls.join("|")}`);
  if (meta.afterUrls.length) lines.push(`after: ${meta.afterUrls.join("|")}`);
  if (!lines.length) return "";
  return `---\nMETA\n${lines.join("\\n")}\n---`;
};

export default function BragWrite() {
  const [form, setForm] = useState({
    title: "",
    movement: "",
    weight: "",
    duration: "",
    routine: "",
    mood: "",
    tips: "",
    nextGoal: "",
    content: "",
    region: "",
    gym: "",
  });
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);

  const suggestedTags = [
    "PR",
    "체형변화",
    "벌크업",
    "컷팅",
    "자극",
    "루틴공유",
    "식단공유",
    "근비대",
    "초보",
  ];

  useEffect(() => {
    logEvent("brag_write", "page_view");
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as typeof form & { tags?: string[]; mediaItems?: MediaItem[] };
      const { tags: draftTags, mediaItems: draftMediaItems, ...draftForm } = parsed;
      setForm((prev) => ({ ...prev, ...draftForm }));
      setTags(draftTags || []);
      setMediaItems(draftMediaItems || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const payload = { ...form, tags, mediaItems };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      setDraftSavedAt(new Date());
    }, 500);
    return () => clearTimeout(timer);
  }, [form, tags, mediaItems]);

  const canSubmit = useMemo(() => {
    return form.title.trim() && form.content.trim();
  }, [form.title, form.content]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      setErr("제목과 본문을 입력하세요.");
      return;
    }
    if (mediaItems.length > 10) {
      setErr("사진/영상은 최대 10개까지 업로드할 수 있어요.");
      return;
    }

    const beforeUrls = mediaItems.filter((item) => item.kind === "before").map((item) => item.url);
    const afterUrls = mediaItems.filter((item) => item.kind === "after").map((item) => item.url);
    const metaBlock = buildMetaBlock({
      tags,
      region: form.region.trim() || undefined,
      gym: form.gym.trim() || undefined,
      routine: form.routine.trim() || undefined,
      mood: form.mood.trim() || undefined,
      tips: form.tips.trim() || undefined,
      nextGoal: form.nextGoal.trim() || undefined,
      duration: form.duration.trim() || undefined,
      beforeUrls,
      afterUrls,
    });

    const payload: BragPostPayload = {
      title: form.title.trim(),
      content: `${form.content.trim()}${metaBlock ? `\n\n${metaBlock}` : ""}`,
      movement: form.movement.trim() || undefined,
      weight: form.weight.trim() || undefined,
      mediaUrls: mediaItems.map((item) => item.url),
    };

    try {
      setSubmitting(true);
      setErr(null);
      await api("/api/brags", { method: "POST", body: JSON.stringify(payload) });
      alert("자랑글이 등록됐어요!");
      localStorage.removeItem(DRAFT_KEY);
      window.location.href = "/brag";
    } catch (e: any) {
      setErr(e?.message || "등록에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploaded = (url: string) => {
    setMediaItems((prev) => [...prev, { url, kind: "normal" }]);
  };

  const removeMedia = (url: string) => {
    setMediaItems((prev) => prev.filter((item) => item.url !== url));
  };

  const updateMediaKind = (url: string, kind: MediaItem["kind"]) => {
    setMediaItems((prev) => prev.map((item) => (item.url === url ? { ...item, kind } : item)));
  };

  const addTag = (tag: string) => {
    const cleaned = tag.replace(/[#\s]/g, "").trim();
    if (!cleaned || tags.includes(cleaned)) return;
    setTags((prev) => [...prev, cleaned]);
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleAddTag = () => {
    addTag(tagInput);
    setTagInput("");
  };

  return (
    <section className="pt-28 pb-20 px-5 md:px-10 bg-gradient-to-br from-[#0f1118] via-[#151a29] to-[#0a0c12] min-h-screen text-white">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-orange-200">Brag Studio</p>
          <h1 className="text-3xl md:text-5xl font-extrabold">자랑글 올리기</h1>
          <p className="text-sm text-white/60">
            오늘의 기록을 공유하고, 내 루틴을 함께하는 사람들과 에너지를 나눠요.
          </p>
          {draftSavedAt && (
            <p className="text-xs text-white/40">
              임시 저장됨: {draftSavedAt.toLocaleTimeString("ko-KR")}
            </p>
          )}
        </header>

        <form onSubmit={handleSubmit} className="glass-panel p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-white/70">제목</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 focus:outline-none focus:border-orange-400"
                placeholder="예: 벤치프레스 PR 150kg 달성!"
                required
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <label className="text-sm text-white/70">종목</label>
                <input
                  type="text"
                  value={form.movement}
                  onChange={(e) => setForm({ ...form, movement: e.target.value })}
                  className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 focus:outline-none focus:border-orange-400"
                  placeholder="스쿼트"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">무게</label>
                <input
                  type="text"
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: e.target.value })}
                  className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 focus:outline-none focus:border-orange-400"
                  placeholder="120kg"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">운동 시간</label>
                <input
                  type="text"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 focus:outline-none focus:border-orange-400"
                  placeholder="60분"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-white/70">지역</label>
              <input
                type="text"
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 focus:outline-none focus:border-orange-400"
                placeholder="강남구 논현동"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70">헬스장</label>
              <input
                type="text"
                value={form.gym}
                onChange={(e) => setForm({ ...form, gym: e.target.value })}
                className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 focus:outline-none focus:border-orange-400"
                placeholder="피트존 논현점"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm text-white/70">태그</label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="rounded-full border border-orange-400/60 px-3 py-1 text-xs text-orange-200 hover:bg-orange-500/10"
                >
                  #{tag} 삭제
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                className="flex-1 rounded-2xl bg-black/40 border border-white/10 px-4 py-2 text-sm focus:outline-none focus:border-orange-400"
                placeholder="#태그 입력"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="rounded-2xl border border-white/20 px-4 py-2 text-sm"
              >
                추가
              </button>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-white/60">
              {suggestedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addTag(tag)}
                  className="rounded-full border border-white/10 px-3 py-1 hover:border-white/30"
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-white/70">루틴 요약</label>
              <textarea
                value={form.routine}
                onChange={(e) => setForm({ ...form, routine: e.target.value })}
                className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 focus:outline-none focus:border-orange-400 min-h-[120px]"
                placeholder="예: 스쿼트 5x5, 레그프레스 3x12"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70">오늘 컨디션</label>
              <textarea
                value={form.mood}
                onChange={(e) => setForm({ ...form, mood: e.target.value })}
                className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 focus:outline-none focus:border-orange-400 min-h-[120px]"
                placeholder="예: 컨디션 좋고 힘이 잘 나왔어요"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-white/70">성공 포인트</label>
              <textarea
                value={form.tips}
                onChange={(e) => setForm({ ...form, tips: e.target.value })}
                className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 focus:outline-none focus:border-orange-400 min-h-[100px]"
                placeholder="예: 마지막 세트는 90초 쉬고 집중했어요"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70">다음 목표</label>
              <textarea
                value={form.nextGoal}
                onChange={(e) => setForm({ ...form, nextGoal: e.target.value })}
                className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 focus:outline-none focus:border-orange-400 min-h-[100px]"
                placeholder="예: 데드리프트 160kg 도전"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-white/70">본문</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 focus:outline-none focus:border-orange-400 min-h-[160px]"
              placeholder="오늘 운동과 느낀 점을 자유롭게 적어주세요."
              required
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm text-white/70">사진/영상 업로드</label>
            <UploadDropzone onUploaded={handleUploaded} accept="image/*,video/*" multiple folder="brag" />
            {mediaItems.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {mediaItems.map((item) => {
                  const url = withBase(item.url);
                  return (
                    <div key={item.url} className="rounded-2xl border border-white/10 bg-black/30 p-3 space-y-2">
                      <div className="overflow-hidden rounded-xl">
                        {/(\.mp4|\.mov|\.webm|\.avi|\.mkv)(\?|$)/i.test(url.split("?")[0]) ? (
                          <video src={url} className="w-full h-44 object-cover" controls />
                        ) : (
                          <img src={url} alt="media" className="w-full h-44 object-cover" />
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {(["normal", "before", "after"] as const).map((kind) => (
                          <button
                            key={kind}
                            type="button"
                            onClick={() => updateMediaKind(item.url, kind)}
                            className={`rounded-full border px-3 py-1 ${
                              item.kind === kind
                                ? "border-orange-400 bg-orange-500/20 text-orange-200"
                                : "border-white/10 text-white/60"
                            }`}
                          >
                            {kind === "normal" ? "일반" : kind === "before" ? "Before" : "After"}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => removeMedia(item.url)}
                          className="rounded-full border border-red-500/40 px-3 py-1 text-red-200"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {err && <p className="text-sm text-red-400">{err}</p>}

          <div className="flex flex-wrap gap-3 items-center">
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(DRAFT_KEY);
                setForm({
                  title: "",
                  movement: "",
                  weight: "",
                  duration: "",
                  routine: "",
                  mood: "",
                  tips: "",
                  nextGoal: "",
                  content: "",
                  region: "",
                  gym: "",
                });
                setTags([]);
                setMediaItems([]);
              }}
              className="rounded-2xl border border-white/20 px-4 py-2 text-sm"
            >
              작성 초기화
            </button>
            <a href="/brag" className="rounded-2xl border border-white/20 px-4 py-2 text-sm text-white/80">
              돌아가기
            </a>
            <button
              type="submit"
              disabled={submitting || !canSubmit}
              className="flex-1 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 font-semibold hover:brightness-110 transition disabled:opacity-60"
            >
              {submitting ? "등록 중..." : "자랑 올리기"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
