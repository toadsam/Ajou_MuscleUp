import { useEffect, useMemo, useState } from "react";
import UploadDropzone from "../components/UploadDropzone";
import { logEvent } from "../utils/analytics";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const withBase = (url: string) => (url?.startsWith("http") ? url : `${API_BASE}${url}`);
const DRAFT_KEY = "brag_write_draft_v2";

type BragPostPayload = {
  title: string;
  content: string;
  movement?: string;
  weight?: string;
  mediaUrls: string[];
  visibility?: "PUBLIC" | "FRIENDS";
};

type MediaItem = {
  url: string;
  kind: "normal" | "before" | "after";
};

type TemplateKey = "today" | "pr" | "body" | "routine";

type TemplateDef = {
  key: TemplateKey;
  label: string;
  emoji: string;
  titleHint: string;
  bodyHint: string;
  suggestedTags: string[];
};

const templates: TemplateDef[] = [
  {
    key: "today",
    label: "오늘 운동",
    emoji: "🔥",
    titleHint: "예: 오늘 하체 루틴 완료",
    bodyHint: "오늘 한 운동과 한 줄 소감을 적어보세요.",
    suggestedTags: ["오늘운동", "루틴기록", "운동완료"],
  },
  {
    key: "pr",
    label: "PR 달성",
    emoji: "🏆",
    titleHint: "예: 벤치프레스 80kg PR 달성",
    bodyHint: "무엇을 얼마나 달성했는지, 어떤 점이 좋았는지 적어보세요.",
    suggestedTags: ["PR", "기록갱신", "성장중"],
  },
  {
    key: "body",
    label: "체형 변화",
    emoji: "📸",
    titleHint: "예: 4주 차 체형 변화 기록",
    bodyHint: "Before / After 변화와 느낀 점을 간단히 적어보세요.",
    suggestedTags: ["체형변화", "BeforeAfter", "꾸준함"],
  },
  {
    key: "routine",
    label: "루틴 공유",
    emoji: "📝",
    titleHint: "예: 초보자용 상체 루틴 공유",
    bodyHint: "운동 순서, 세트 수, 팁을 짧게 정리해보세요.",
    suggestedTags: ["루틴공유", "초보루틴", "운동팁"],
  },
];

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
  return `---\nMETA\n${lines.join("\n")}\n---`;
};

const getTemplateByKey = (key: TemplateKey) => templates.find((item) => item.key === key) ?? templates[0];

export default function BragWrite() {
  const [templateKey, setTemplateKey] = useState<TemplateKey>("today");
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
    visibility: "PUBLIC",
  });
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);

  const selectedTemplate = getTemplateByKey(templateKey);

  useEffect(() => {
    logEvent("brag_write", "page_view");
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        templateKey?: TemplateKey;
        tags?: string[];
        mediaItems?: MediaItem[];
      } & typeof form;
      if (parsed.templateKey) setTemplateKey(parsed.templateKey);
      setTags(parsed.tags || []);
      setMediaItems(parsed.mediaItems || []);
      setForm((prev) => ({ ...prev, ...parsed }));
    } catch {
      // ignore invalid draft
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...form, templateKey, tags, mediaItems }));
      setDraftSavedAt(new Date());
    }, 500);
    return () => clearTimeout(timer);
  }, [form, mediaItems, tags, templateKey]);

  const canSubmit = useMemo(() => Boolean(form.title.trim() && form.content.trim()), [form.title, form.content]);

  const beforeUrls = useMemo(
    () => mediaItems.filter((item) => item.kind === "before").map((item) => item.url),
    [mediaItems]
  );
  const afterUrls = useMemo(
    () => mediaItems.filter((item) => item.kind === "after").map((item) => item.url),
    [mediaItems]
  );

  const autoCaption = useMemo(() => {
    const parts = [];
    if (form.movement.trim()) parts.push(form.movement.trim());
    if (form.weight.trim()) parts.push(form.weight.trim());
    const subject = parts.length ? parts.join(" ") : selectedTemplate.label;
    const mood = form.mood.trim() || "한 걸음 더 성장했습니다";
    return `${subject} 기록 완료. ${mood}`;
  }, [form.mood, form.movement, form.weight, selectedTemplate.label]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      setErr("제목과 본문을 입력하세요.");
      return;
    }
    if (mediaItems.length > 10) {
      setErr("사진/영상은 최대 10개까지 업로드할 수 있습니다.");
      return;
    }

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
      visibility: form.visibility as "PUBLIC" | "FRIENDS",
    };

    try {
      setSubmitting(true);
      setErr(null);
      await api("/api/brags", { method: "POST", body: JSON.stringify(payload) });
      localStorage.removeItem(DRAFT_KEY);
      alert("자랑글이 등록되었습니다.");
      window.location.href = "/brag";
    } catch (e: any) {
      setErr(e?.message || "등록에 실패했습니다.");
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

  const handleTemplateSelect = (nextKey: TemplateKey) => {
    const nextTemplate = getTemplateByKey(nextKey);
    setTemplateKey(nextKey);
    setTags((prev) => [...new Set([...nextTemplate.suggestedTags, ...prev])].slice(0, 8));
    if (!form.title.trim()) {
      setForm((prev) => ({ ...prev, title: nextTemplate.titleHint }));
    }
  };

  const fillQuickExample = () => {
    setForm((prev) => ({
      ...prev,
      title: prev.title || selectedTemplate.titleHint,
      content:
        prev.content ||
        `${selectedTemplate.label} 기록입니다.\n오늘 좋았던 점 한 가지와 다음 목표를 간단히 남겨봤어요.`,
      mood: prev.mood || "컨디션이 좋아서 운동 집중이 잘 됐어요.",
      routine: prev.routine || (templateKey === "routine" ? "워밍업 10분\n메인 루틴 3세트\n정리 운동 5분" : prev.routine),
    }));
    selectedTemplate.suggestedTags.forEach(addTag);
  };

  const resetAll = () => {
    localStorage.removeItem(DRAFT_KEY);
    setTemplateKey("today");
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
      visibility: "PUBLIC",
    });
    setTags([]);
    setMediaItems([]);
  };

  return (
    <section className="min-h-screen bg-gradient-to-br from-[#0f1118] via-[#151a29] to-[#0a0c12] px-5 pb-20 pt-28 text-white md:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="grid gap-5 rounded-[30px] border border-white/10 bg-gradient-to-br from-orange-500/18 via-amber-300/10 to-transparent p-6 lg:grid-cols-[1.05fr,0.95fr]">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.4em] text-orange-200">Brag Studio</p>
            <h1 className="text-3xl font-extrabold md:text-5xl">초보도 쉽게 올리는 자랑글</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-white/65">
              템플릿을 고르고 사진과 핵심 기록만 넣으면 자랑글이 바로 완성됩니다.
              작성 후에는 목록과 상세에서 바로 공유할 수 있습니다.
            </p>
            {draftSavedAt && (
              <p className="text-xs text-white/40">임시 저장됨: {draftSavedAt.toLocaleTimeString("ko-KR")}</p>
            )}
          </div>
          <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
            <div className="text-xs font-semibold tracking-[0.24em] text-orange-200">빠른 작성 순서</div>
            <div className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-1">
              {[
                "1. 템플릿 선택",
                "2. 운동 기록과 사진 입력",
                "3. 자동 미리보기 확인 후 등록",
              ].map((step) => (
                <div key={step} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
                  {step}
                </div>
              ))}
            </div>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-bold">1. 자랑 템플릿 선택</div>
                  <p className="mt-1 text-sm text-white/55">무엇을 자랑할지 먼저 고르면 입력이 훨씬 쉬워집니다.</p>
                </div>
                <button type="button" onClick={fillQuickExample} className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/75">
                  예시 자동 채우기
                </button>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {templates.map((template) => (
                  <button
                    key={template.key}
                    type="button"
                    onClick={() => handleTemplateSelect(template.key)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      templateKey === template.key
                        ? "border-orange-300/60 bg-orange-500/15"
                        : "border-white/10 bg-black/20 hover:border-white/25"
                    }`}
                  >
                    <div className="text-2xl">{template.emoji}</div>
                    <div className="mt-3 font-semibold">{template.label}</div>
                    <p className="mt-1 text-sm text-white/60">{template.bodyHint}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-5">
              <div>
                <div className="text-lg font-bold">2. 핵심 기록 입력</div>
                <p className="mt-1 text-sm text-white/55">제목, 운동 기록, 한 줄 소감만 있으면 바로 올릴 수 있습니다.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm text-white/70">제목</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 focus:border-orange-400 focus:outline-none"
                    placeholder={selectedTemplate.titleHint}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70">종목</label>
                  <input
                    type="text"
                    value={form.movement}
                    onChange={(e) => setForm({ ...form, movement: e.target.value })}
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 focus:border-orange-400 focus:outline-none"
                    placeholder="예: 스쿼트"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70">무게 / 기록</label>
                  <input
                    type="text"
                    value={form.weight}
                    onChange={(e) => setForm({ ...form, weight: e.target.value })}
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 focus:border-orange-400 focus:outline-none"
                    placeholder="예: 100kg / 10회"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70">운동 시간</label>
                  <input
                    type="text"
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 focus:border-orange-400 focus:outline-none"
                    placeholder="예: 60분"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70">공개 범위</label>
                  <select
                    value={form.visibility}
                    onChange={(e) => setForm({ ...form, visibility: e.target.value })}
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 focus:border-orange-400 focus:outline-none"
                  >
                    <option value="PUBLIC">전체 공개</option>
                    <option value="FRIENDS">친구 공개</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm text-white/70">본문</label>
                  <textarea
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    className="min-h-[150px] w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 focus:border-orange-400 focus:outline-none"
                    placeholder={selectedTemplate.bodyHint}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm text-white/70">지역</label>
                  <input
                    type="text"
                    value={form.region}
                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 focus:border-orange-400 focus:outline-none"
                    placeholder="예: 수원 영통구"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70">헬스장</label>
                  <input
                    type="text"
                    value={form.gym}
                    onChange={(e) => setForm({ ...form, gym: e.target.value })}
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 focus:border-orange-400 focus:outline-none"
                    placeholder="예: AJOU GYM"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70">오늘 컨디션</label>
                  <textarea
                    value={form.mood}
                    onChange={(e) => setForm({ ...form, mood: e.target.value })}
                    className="min-h-[110px] w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 focus:border-orange-400 focus:outline-none"
                    placeholder="예: 컨디션이 좋아서 집중이 잘 됐어요."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/70">루틴 요약</label>
                  <textarea
                    value={form.routine}
                    onChange={(e) => setForm({ ...form, routine: e.target.value })}
                    className="min-h-[110px] w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 focus:border-orange-400 focus:outline-none"
                    placeholder="예: 스쿼트 5x5, 런지 3x12"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-5">
              <div>
                <div className="text-lg font-bold">3. 사진과 태그</div>
                <p className="mt-1 text-sm text-white/55">사진은 1장만 있어도 좋고, 체형 변화면 Before / After를 구분해서 올릴 수 있습니다.</p>
              </div>

              <div className="space-y-3">
                <label className="text-sm text-white/70">추천 태그</label>
                <div className="flex flex-wrap gap-2">
                  {[...new Set([...selectedTemplate.suggestedTags, "성장중", "운동인증", "루틴공유", "헬린이"])]
                    .slice(0, 8)
                    .map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => addTag(tag)}
                        className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70 hover:border-white/30"
                      >
                        #{tag}
                      </button>
                    ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setTags((prev) => prev.filter((value) => value !== tag))}
                      className="rounded-full border border-orange-400/60 px-3 py-1 text-xs text-orange-200"
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
                    className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-sm focus:border-orange-400 focus:outline-none"
                    placeholder="#직접 입력"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      addTag(tagInput);
                      setTagInput("");
                    }}
                    className="rounded-2xl border border-white/20 px-4 py-2 text-sm"
                  >
                    추가
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm text-white/70">사진 / 영상 업로드</label>
                <UploadDropzone onUploaded={handleUploaded} accept="image/*,video/*" multiple folder="brag" />
                {mediaItems.length > 0 && (
                  <div className="grid gap-3 md:grid-cols-2">
                    {mediaItems.map((item) => {
                      const url = withBase(item.url);
                      const isVid = /(\.mp4|\.mov|\.webm|\.avi|\.mkv)(\?|$)/i.test(url.split("?")[0]);
                      return (
                        <div key={item.url} className="rounded-2xl border border-white/10 bg-black/30 p-3 space-y-2">
                          <div className="overflow-hidden rounded-xl">
                            {isVid ? (
                              <video src={url} className="h-44 w-full object-cover" controls />
                            ) : (
                              <img src={url} alt="media" className="h-44 w-full object-cover" />
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
            </div>
          </div>

          <aside className="space-y-6">
            <div className="sticky top-28 space-y-6">
              <div className="rounded-3xl border border-white/10 bg-[#141827] p-6">
                <div className="text-xs font-semibold tracking-[0.24em] text-orange-200">자동 캡션</div>
                <p className="mt-3 rounded-2xl border border-orange-300/20 bg-orange-500/10 px-4 py-4 text-sm leading-relaxed text-orange-50">
                  {autoCaption}
                </p>
                <p className="mt-3 text-xs text-white/45">초보가 문구를 고민하지 않도록 공유용 한 줄을 자동 제안합니다.</p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="text-lg font-bold">미리보기</div>
                <p className="mt-1 text-sm text-white/55">등록되면 이런 카드 느낌으로 보입니다.</p>

                <div className="mt-5 overflow-hidden rounded-[26px] border border-white/10 bg-black/30">
                  <div className="flex h-44 items-end bg-gradient-to-br from-orange-500/30 via-amber-200/8 to-transparent p-5">
                    <div>
                      <div className="text-xs uppercase tracking-[0.24em] text-orange-200">{selectedTemplate.label}</div>
                      <div className="mt-2 text-xl font-bold text-white">{form.title.trim() || selectedTemplate.titleHint}</div>
                    </div>
                  </div>
                  <div className="space-y-4 p-5">
                    <div className="flex flex-wrap gap-2 text-xs">
                      {form.movement && <span className="rounded-full bg-white/10 px-3 py-1">{form.movement}</span>}
                      {form.weight && <span className="rounded-full bg-white/10 px-3 py-1">{form.weight}</span>}
                      {form.duration && <span className="rounded-full bg-white/10 px-3 py-1">{form.duration}</span>}
                      {tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded-full bg-orange-500/15 px-3 py-1 text-orange-100">#{tag}</span>
                      ))}
                    </div>
                    <p className="text-sm leading-relaxed text-white/70">
                      {form.content.trim() || selectedTemplate.bodyHint}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {mediaItems.slice(0, 2).map((item) => (
                        <div key={`preview-${item.url}`} className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                          <img src={withBase(item.url)} alt="preview" className="h-24 w-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {err && <p className="text-sm text-red-400">{err}</p>}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={resetAll}
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
                  className="flex-1 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 font-semibold transition hover:brightness-110 disabled:opacity-60"
                >
                  {submitting ? "등록 중..." : "자랑 올리기"}
                </button>
              </div>
            </div>
          </aside>
        </form>
      </div>
    </section>
  );
}
