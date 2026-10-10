import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { logEvent } from "../utils/analytics";
import { useCountUp } from "../hooks/useCountUp";
import { useInView } from "../hooks/useInView";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

const tabs = [
  { id: "analysis", label: "체성 분석", description: "AI가 체성 정보를 분석해 현재 상태와 코칭 포인트를 안내해요." },
  { id: "plan", label: "루틴 설계", description: "목표와 일정에 맞춘 4주 루틴을 구체적으로 받아보세요." },
  { id: "chat", label: "AI 상담", description: "운동/식단 고민을 상담하면 기록으로 남아 언제든 다시 볼 수 있습니다." },
];

const liveTiles = [
  { title: "AI 루틴 분석", tag: "분석", status: "92% 진행", color: "border-l-plate-green" },
  { title: "30분 체형 교정", tag: "코칭", status: "DAY 12", color: "border-l-plate-red" },
  { title: "목표 심박 유지", tag: "현황", status: "120 bpm", color: "border-l-plate-blue" },
];

interface ChatBubble {
  role: "user" | "assistant";
  content: string;
}

interface ChatHistoryItem {
  id?: number;
  type?: string;
  question: string;
  answer: string;
  createdAt: string;
  shared?: boolean;
  shareSlug?: string | null;
}

export default function AiFitness() {
  const [activeTab, setActiveTab] = useState("analysis");

  const [analysisForm, setAnalysisForm] = useState({ height: "", weight: "", bodyFat: "", muscleMass: "", goal: "" });
  const [planForm, setPlanForm] = useState({
    experienceLevel: "초급",
    availableDays: "주 3회",
    focusArea: "자세/체형 개선",
    equipment: "덤벨, 밴드",
    preferredTime: "40분",
    notes: "최근 하체 운동 선호",
  });
  const [question, setQuestion] = useState("필라테스 처음인데 체형교정은 어떻게 시작할까요?");
  const [chatHistory, setChatHistory] = useState<ChatBubble[]>([]);
  const [savedHistory, setSavedHistory] = useState<ChatHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFetched, setHistoryFetched] = useState(false);

  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [planResult, setPlanResult] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isAnalyzing = loading === "/api/ai/analyze";
  const isPlanning = loading === "/api/ai/plan";
  const isChatting = loading === "/api/ai/chat";

  const [hasSession] = useState<boolean>(() => !!localStorage.getItem("user"));
  const headers = useMemo(() => ({ "Content-Type": "application/json" }), []);

  const callAi = async (path: string, payload: unknown) => {
    setLoading(path);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error((await res.text()) || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err: any) {
      setError(err?.message ?? "AI 요청 중 오류가 발생했습니다.");
      throw err;
    } finally {
      setLoading(null);
    }
  };

  const fetchHistory = async () => {
    if (!hasSession) return;
    setHistoryLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/ai/chat/history`, {
        method: "GET",
        headers,
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error((await res.text()) || `HTTP ${res.status}`);
      }
      const data: ChatHistoryItem[] = await res.json();
      setSavedHistory(data);
      setHistoryFetched(true);
    } catch (err: any) {
      setError(err?.message ?? "상담 기록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "chat" && hasSession && !historyFetched) {
      fetchHistory();
    }
  }, [activeTab, hasSession, historyFetched]);

  useEffect(() => {
    logEvent("ai", "page_view");
  }, []);

  const handleAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = await callAi("/api/ai/analyze", analysisForm);
    setAnalysisResult(data.explanation ?? data.content ?? JSON.stringify(data));
  };

  const handlePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = await callAi("/api/ai/plan", planForm);
    setPlanResult(data.plan ?? JSON.stringify(data));
  };

  const handleChat = async () => {
    if (!question.trim()) return;
    if (!hasSession) {
      setError("AI 상담을 이용하려면 로그인하세요.");
      return;
    }
    const newHistory: ChatBubble[] = [...chatHistory, { role: "user", content: question }];
    setChatHistory(newHistory);
    setQuestion("");
    const data = await callAi("/api/ai/chat", {
      question,
      context: newHistory.map((m) => (m.role === "user" ? `사용자: ${m.content}` : `코치: ${m.content}`)).join("\n"),
    });
    const answer = data.answer ?? JSON.stringify(data);
    setChatHistory((prev) => [...prev, { role: "assistant", content: answer }]);
    setSavedHistory((prev) => [{ question, answer, createdAt: new Date().toISOString() }, ...prev]);
  };

  const shareHistory = async (item: ChatHistoryItem) => {
    if (!item.id) return;
    try {
      const res = await fetch(`${API_BASE}/api/ai/chat/history/${item.id}/share`, {
        method: "POST",
        headers,
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const data = await res.json();
      setSavedHistory((prev) =>
        prev.map((h) => (h.id === item.id ? { ...h, shared: true, shareSlug: data.shareSlug } : h))
      );
      if (data.shareSlug) {
        await navigator.clipboard.writeText(`${window.location.origin}/ai/share/${data.shareSlug}`);
        alert("공유 링크가 복사되었습니다.");
      }
    } catch (e: any) {
      alert(e?.message || "공유에 실패했습니다.");
    }
  };

  const unshareHistory = async (item: ChatHistoryItem) => {
    if (!item.id) return;
    try {
      const res = await fetch(`${API_BASE}/api/ai/chat/history/${item.id}/share`, {
        method: "DELETE",
        headers,
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      setSavedHistory((prev) => prev.map((h) => (h.id === item.id ? { ...h, shared: false, shareSlug: null } : h)));
    } catch (e: any) {
      alert(e?.message || "공유 해제에 실패했습니다.");
    }
  };

  const copyShareLink = (slug?: string | null) => {
    if (!slug) return;
    const link = `${window.location.origin}/ai/share/${slug}`;
    navigator.clipboard.writeText(link).then(
      () => alert("링크가 클립보드에 복사되었습니다."),
      () => alert("클립보드 복사에 실패했습니다.")
    );
  };

  const renderAnalysisForm = () => (
    <form onSubmit={handleAnalysis} className="dg-steel dg-rise space-y-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="키(cm)" name="height" value={analysisForm.height} onChange={setAnalysisForm} required />
        <Input label="체중(kg)" name="weight" value={analysisForm.weight} onChange={setAnalysisForm} required />
        <Input label="체지방률(%)" name="bodyFat" value={analysisForm.bodyFat} onChange={setAnalysisForm} />
        <Input label="골격근량(kg)" name="muscleMass" value={analysisForm.muscleMass} onChange={setAnalysisForm} />
      </div>
      <Input label="목표 또는 요청사항" name="goal" value={analysisForm.goal} onChange={setAnalysisForm} textarea />
      <button className="dg-btn dg-btn-primary w-full py-3 text-lg" disabled={isAnalyzing}>
        {isAnalyzing ? "AI가 분석 중..." : "분석 결과 받기"}
      </button>
      {isAnalyzing && <LoadingCard label="AI가 입력 데이터를 분석하고 있어요..." />}
      {analysisResult && <ResultCard key={analysisResult} title="AI 분석 리포트" content={analysisResult} />}
    </form>
  );

  const renderPlanForm = () => (
    <form onSubmit={handlePlan} className="dg-steel dg-rise space-y-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="운동 경험" name="experienceLevel" value={planForm.experienceLevel} options={["입문", "초급", "중급", "상급"]} onChange={setPlanForm} />
        <Input label="주간 가능 횟수" name="availableDays" value={planForm.availableDays} onChange={setPlanForm} />
        <Input label="집중 부위/목표" name="focusArea" value={planForm.focusArea} onChange={setPlanForm} />
        <Input label="사용 가능한 장비" name="equipment" value={planForm.equipment} onChange={setPlanForm} />
        <Input label="선호 운동 시간" name="preferredTime" value={planForm.preferredTime} onChange={setPlanForm} />
      </div>
      <Input label="추가 메모" name="notes" value={planForm.notes} onChange={setPlanForm} textarea />
      <button className="dg-btn dg-btn-primary w-full py-3 text-lg" disabled={isPlanning}>
        {isPlanning ? "AI가 루틴을 설계 중..." : "맞춤 루틴 받기"}
      </button>
      {isPlanning && <LoadingCard label="AI가 목표와 조건에 맞춰 루틴을 설계하고 있어요..." />}
      {planResult && <ResultCard key={planResult} title="AI 루틴 제안" content={planResult} />}
    </form>
  );

  const renderChat = () => (
    <div className="space-y-5">
      <div className="dg-steel dg-rise flex flex-col gap-4 p-6">
        <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
          {chatHistory.length === 0 && <p className="text-sm text-steel-400">AI 상담을 시작해보세요. 기록이 자동으로 저장됩니다.</p>}
          {chatHistory.map((msg, idx) => (
            <div
              key={idx}
              className={`dg-rise rounded-md border-2 border-black px-4 py-3 text-sm ${
                msg.role === "user" ? "ml-6 bg-steel-700 text-chalk" : "mr-6 border-l-[6px] border-l-plate-red bg-steel-900 text-steel-100"
              }`}
            >
              <p className={`text-xs font-bold ${msg.role === "user" ? "text-steel-300" : "text-red-300"}`}>{msg.role === "user" ? "나" : "AI 코치"}</p>
              <p className="mt-1 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          ))}
          {isChatting && (
            <div className="dg-rise mr-6 rounded-md border-2 border-black border-l-[6px] border-l-plate-red bg-steel-900 px-4 py-3 text-sm text-steel-100">
              <p className="text-xs font-bold text-red-300">AI 코치</p>
              <div className="mt-2 flex items-center gap-3">
                <span className="dg-loading-plates" aria-label="불러오는 중"><i /><i /><i /><i /></span>
                <p>답변 작성 중...</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <input
            className="min-w-0 flex-1 rounded-md border-2 border-black bg-steel-900 px-4 py-3 text-sm text-chalk placeholder:text-steel-500 transition-colors focus:border-plate-yellow focus:outline-none"
            placeholder="AI 상담에게 궁금한 내용을 입력하세요"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={isChatting}
          />
          <button type="button" onClick={handleChat} className="dg-btn dg-btn-primary px-6" disabled={isChatting}>
            {isChatting ? "답변 중..." : "상담"}
          </button>
        </div>
      </div>

      <div className="dg-steel dg-rise space-y-4 p-6" style={{ animationDelay: "60ms" }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-steel-400">AI 상담 기록</p>
            <p className="font-display text-xl text-chalk">내 히스토리</p>
          </div>
          <button
            type="button"
            onClick={fetchHistory}
            disabled={historyLoading || !hasSession}
            className="dg-btn dg-btn-steel min-h-0 h-10 px-4 text-sm"
          >
            <RefreshIcon spinning={historyLoading} />
            새로고침
          </button>
        </div>
        {!hasSession && <p className="text-sm text-steel-400">로그인하면 상담 기록을 불러올 수 있습니다.</p>}
        {historyLoading && (
          <div className="flex items-center gap-3 text-sm text-steel-300">
            <span className="dg-loading-plates" aria-label="불러오는 중"><i /><i /><i /><i /></span>
            상담 기록을 불러오는 중...
          </div>
        )}
        {!historyLoading && savedHistory.length === 0 && hasSession && <p className="text-sm text-steel-400">아직 저장된 상담 기록이 없습니다.</p>}
        <div className="space-y-3">
          {savedHistory.map((item, idx) => (
            <div
              key={item.id ?? idx}
              className={`dg-well dg-rise space-y-2 border-l-[6px] p-4 transition-transform duration-150 hover:-translate-y-0.5 ${
                item.shared && item.shareSlug ? "border-l-plate-green" : "border-l-steel-600"
              }`}
              style={{ animationDelay: `${Math.min(idx, 10) * 50}ms` }}
            >
              <div className="flex items-center justify-between text-xs text-steel-400">
                <span className="font-num text-sm font-black tracking-wide">Q&A</span>
                <span className="font-num text-sm font-bold">{formatDate(item.createdAt)}</span>
              </div>
              <p className="text-sm font-semibold text-chalk">Q. {item.question}</p>
              <p className="whitespace-pre-wrap text-sm text-steel-200">A. {item.answer}</p>
              {item.id && (
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  {item.shared && item.shareSlug ? (
                    <>
                      <span className="dg-chip dg-pop bg-plate-green text-black">
                        <CheckIcon />
                        공유 중
                      </span>
                      <button
                        className="dg-btn dg-btn-steel min-h-0 h-9 px-3 text-xs"
                        onClick={() => copyShareLink(item.shareSlug)}
                      >
                        링크 복사
                      </button>
                      <button
                        className="dg-btn min-h-0 h-9 bg-steel-800 px-3 text-xs text-red-300"
                        onClick={() => unshareHistory(item)}
                      >
                        공유 해제
                      </button>
                    </>
                  ) : (
                    <button
                      className="dg-btn dg-btn-primary min-h-0 h-9 px-3 text-xs"
                      onClick={() => shareHistory(item)}
                    >
                      공유 링크 만들기
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderActiveTab = () => {
    switch (activeTab) {
      case "plan":
        return renderPlanForm();
      case "chat":
        return renderChat();
      default:
        return renderAnalysisForm();
    }
  };

  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === activeTab));

  return (
    <section className="relative min-h-screen px-6 pb-20 pt-28 text-chalk lg:px-10">
      <div className="relative mx-auto flex max-w-6xl flex-col gap-12 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-6">
          <div role="tablist" aria-label="AI 기능" className="dg-well relative grid grid-cols-3 p-1">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-1 left-1 top-1 rounded border-2 border-black bg-plate-red shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.3,1.3,0.5,1)]"
              style={{ width: "calc((100% - 0.5rem) / 3)", transform: `translateX(${activeIndex * 100}%)` }}
            />
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative z-10 rounded px-3 py-2.5 text-sm font-bold transition-colors ${
                  activeTab === tab.id ? "text-white" : "text-steel-300 hover:text-chalk"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <p key={activeTab} className="dg-rise text-sm text-steel-300">{tabs.find((t) => t.id === activeTab)?.description}</p>
          <Link to="/ai/inbody" className="dg-btn dg-btn-steel group min-h-0 h-11 border-l-[8px] border-l-plate-green text-sm">
            인바디 사진/PDF 분석으로 이동
            <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
          {error && <p className="dg-well dg-pop border-l-[6px] border-l-plate-red px-4 py-3 text-sm text-red-200">{error}</p>}
          <div key={activeTab}>{renderActiveTab()}</div>
        </div>

        <div className="min-w-0 flex-1 space-y-6">
          <div className="dg-steel dg-rise p-6" style={{ animationDelay: "80ms" }}>
            <div className="flex items-center justify-between px-1">
              <div>
                <p className="text-sm text-steel-400">실시간 AI 활용</p>
                <p className="font-num text-3xl font-black tracking-wide">AI Lab</p>
              </div>
              <span className="dg-chip bg-plate-red text-white">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                </span>
                LIVE
              </span>
            </div>
            <div className="mt-6 space-y-3">
              {liveTiles.map((tile, idx) => (
                <div
                  key={tile.title}
                  className={`dg-well dg-plate-in border-l-[8px] p-4 transition-transform duration-150 hover:-translate-y-0.5 ${tile.color}`}
                  style={{ animationDelay: `${120 + idx * 60}ms`, ["--from" as string]: "48px" }}
                >
                  <div className="flex items-center justify-between text-xs text-steel-300">
                    <span className="font-bold">{tile.tag}</span>
                    <span className="font-num text-sm font-black text-chalk">{tile.status}</span>
                  </div>
                  <p className="mt-1 text-lg font-semibold text-chalk">{tile.title}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="dg-steel dg-rise space-y-4 p-6" style={{ animationDelay: "140ms" }}>
            <p className="px-1 text-sm text-steel-400">AI 수행 현황</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "분석 응답", value: "3회" },
                { label: "상담 응답", value: "1건" },
                { label: "루틴 생성", value: "1.8s" },
              ].map((item) => (
                <StatTile key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
            <p className="px-1 text-xs text-steel-400">AI 성능은 네트워크와 서버 상태에 따라 달라질 수 있습니다.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// "3회", "1.8s" 같은 값을 숫자 부분만 0 에서 굴려 올린다(표시 전용).
const StatTile = ({ label, value }: { label: string; value: string }) => {
  const [ref, inView] = useInView<HTMLDivElement>();
  const match = value.match(/^(\d+(?:\.\d+)?)(.*)$/);
  const target = match ? Number(match[1]) : 0;
  const decimals = match && match[1].includes(".") ? match[1].split(".")[1].length : 0;
  const counted = useCountUp(target, { duration: 900, start: inView });
  return (
    <div ref={ref} className="dg-well p-4 text-center transition-transform duration-150 hover:-translate-y-0.5">
      <p className="font-num text-3xl font-black text-plate-yellow">
        {match ? `${counted.toFixed(decimals)}${match[2]}` : value}
      </p>
      <p className="text-xs text-steel-400">{label}</p>
    </div>
  );
};

const RefreshIcon = ({ spinning }: { spinning?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

interface InputProps {
  label: string;
  name: string;
  value: string;
  onChange: (updater: any) => void;
  textarea?: boolean;
  required?: boolean;
}

const fieldClass =
  "mt-2 w-full rounded-md border-2 border-black bg-steel-900 px-4 py-3 text-chalk placeholder:text-steel-500 transition-colors focus:border-plate-yellow focus:outline-none";

const Input = ({ label, name, value, onChange, textarea, required }: InputProps) => (
  <label className="block text-sm font-semibold text-steel-200">
    {label}
    {textarea ? (
      <textarea
        name={name}
        className={fieldClass}
        value={value}
        onChange={(e) => onChange((prev: any) => ({ ...prev, [name]: e.target.value }))}
        rows={3}
        required={required}
      />
    ) : (
      <input
        type="text"
        name={name}
        className={fieldClass}
        value={value}
        onChange={(e) => onChange((prev: any) => ({ ...prev, [name]: e.target.value }))}
        required={required}
      />
    )}
  </label>
);

interface SelectProps {
  label: string;
  name: string;
  value: string;
  options: string[];
  onChange: (updater: any) => void;
}

const Select = ({ label, name, value, options, onChange }: SelectProps) => (
  <label className="block text-sm font-semibold text-steel-200">
    {label}
    <select
      name={name}
      value={value}
      onChange={(e) => onChange((prev: any) => ({ ...prev, [name]: e.target.value }))}
      className={fieldClass}
    >
      {options.map((option) => (
        <option key={option} value={option} className="bg-steel-800 text-chalk">
          {option}
        </option>
      ))}
    </select>
  </label>
);

interface ResultCardProps {
  title: string;
  content: string;
}

const LoadingCard = ({ label }: { label: string }) => (
  <div className="dg-well dg-rise mt-4 flex items-center gap-4 p-4 text-sm text-steel-200">
    <span className="dg-loading-plates" aria-label="불러오는 중"><i /><i /><i /><i /></span>
    <p>{label}</p>
  </div>
);

const ResultCard = ({ title, content }: ResultCardProps) => (
  <div className="dg-well dg-rise mt-6 border-l-[6px] border-l-plate-yellow p-5 text-sm text-steel-100">
    <h3 className="flex items-center gap-2 font-display text-xl text-chalk">
      <span className="dg-pop inline-flex h-6 w-6 items-center justify-center rounded border-2 border-black bg-plate-green text-black">
        <CheckIcon />
      </span>
      {title}
    </h3>
    <pre className="mt-3 whitespace-pre-wrap font-sans leading-relaxed">{content}</pre>
  </div>
);

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return iso;
  }
};
