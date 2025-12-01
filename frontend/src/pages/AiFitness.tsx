import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE;
const USE_CREDENTIALS = import.meta.env.VITE_USE_CREDENTIALS === "true";

const tabs = [
  { id: "analysis", label: "체성 분석", description: "AI가 체성 정보를 분석해 현재 상태와 코칭 포인트를 제안합니다." },
  { id: "plan", label: "루틴 설계", description: "목표와 일정에 맞춘 4주 루틴을 구체적으로 받아보세요." },
  { id: "chat", label: "AI 상담", description: "운동/식단 고민을 상담하면 기록에 남아 언제든 다시 볼 수 있습니다." },
];

const liveTiles = [
  { title: "AI 루틴 분석", tag: "분석", status: "92% 진행", color: "from-emerald-400/20 to-cyan-300/20" },
  { title: "30일 체형 교정", tag: "코칭", status: "DAY 12", color: "from-pink-400/20 to-purple-400/20" },
  { title: "목표 심박 유지", tag: "현황", status: "120 bpm", color: "from-blue-400/20 to-indigo-400/20" },
];

interface ChatBubble {
  role: "user" | "assistant";
  content: string;
}

interface ChatHistoryItem {
  question: string;
  answer: string;
  createdAt: string;
}

export default function AiFitness() {
  const [activeTab, setActiveTab] = useState("analysis");

  const [analysisForm, setAnalysisForm] = useState({ height: "", weight: "", bodyFat: "", muscleMass: "", goal: "" });
  const [planForm, setPlanForm] = useState({
    experienceLevel: "초급",
    availableDays: "주 3일",
    focusArea: "상체/체형 개선",
    equipment: "덤벨, 밴드",
    preferredTime: "40분",
    notes: "오전 운동 선호",
  });
  const [question, setQuestion] = useState("헬스 처음인데 체형교정이 필요해. 어떤 루틴부터 시작할까?");
  const [chatHistory, setChatHistory] = useState<ChatBubble[]>([]);
  const [savedHistory, setSavedHistory] = useState<ChatHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFetched, setHistoryFetched] = useState(false);

  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [planResult, setPlanResult] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const token = useMemo(() => localStorage.getItem("token"), []);
  const headers = useMemo(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  const callAi = async (path: string, payload: unknown) => {
    setLoading(path);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        credentials: USE_CREDENTIALS ? "include" : "same-origin",
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
    if (!token) return;
    setHistoryLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/ai/chat/history`, {
        method: "GET",
        headers,
        credentials: USE_CREDENTIALS ? "include" : "same-origin",
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
    if (activeTab === "chat" && token && !historyFetched) {
      fetchHistory();
    }
  }, [activeTab, token, historyFetched]);

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
    if (!token) {
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

  const renderAnalysisForm = () => (
    <form onSubmit={handleAnalysis} className="glass-panel space-y-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="키(cm)" name="height" value={analysisForm.height} onChange={setAnalysisForm} required />
        <Input label="체중(kg)" name="weight" value={analysisForm.weight} onChange={setAnalysisForm} required />
        <Input label="체지방률(%)" name="bodyFat" value={analysisForm.bodyFat} onChange={setAnalysisForm} />
        <Input label="골격근량(kg)" name="muscleMass" value={analysisForm.muscleMass} onChange={setAnalysisForm} />
      </div>
      <Input label="목표 또는 요청사항" name="goal" value={analysisForm.goal} onChange={setAnalysisForm} textarea />
      <button className="btn-gradient w-full py-3 text-lg" disabled={loading === "/api/ai/analyze"}>
        {loading === "/api/ai/analyze" ? "AI가 분석 중..." : "분석 결과 받기"}
      </button>
      {analysisResult && <ResultCard title="AI 분석 리포트" content={analysisResult} />}
    </form>
  );

  const renderPlanForm = () => (
    <form onSubmit={handlePlan} className="glass-panel space-y-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="운동 경험" name="experienceLevel" value={planForm.experienceLevel} options={["입문", "초급", "중급", "상급"]} onChange={setPlanForm} />
        <Input label="주간 가능 횟수" name="availableDays" value={planForm.availableDays} onChange={setPlanForm} />
        <Input label="집중 부위/목표" name="focusArea" value={planForm.focusArea} onChange={setPlanForm} />
        <Input label="사용 가능한 장비" name="equipment" value={planForm.equipment} onChange={setPlanForm} />
        <Input label="선호 운동 시간" name="preferredTime" value={planForm.preferredTime} onChange={setPlanForm} />
      </div>
      <Input label="추가 메모" name="notes" value={planForm.notes} onChange={setPlanForm} textarea />
      <button className="btn-gradient w-full py-3 text-lg" disabled={loading === "/api/ai/plan"}>
        {loading === "/api/ai/plan" ? "AI가 루틴을 설계하는 중..." : "맞춤 루틴 받기"}
      </button>
      {planResult && <ResultCard title="AI 루틴 제안" content={planResult} />}
    </form>
  );

  const renderChat = () => (
    <div className="space-y-4">
      <div className="glass-panel flex flex-col gap-4 p-6">
        <div className="max-h-64 space-y-4 overflow-y-auto pr-1">
          {chatHistory.length === 0 && <p className="text-sm text-gray-400">AI 상담을 시작해 보세요. 기록은 자동으로 저장됩니다.</p>}
          {chatHistory.map((msg, idx) => (
            <div key={idx} className={`rounded-2xl px-4 py-3 text-sm ${msg.role === "user" ? "bg-white/20 text-white" : "bg-black/30 text-gray-100"}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-300">{msg.role === "user" ? "나" : "AI 코치"}</p>
              <p className="mt-1 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <input
            className="flex-1 rounded-2xl bg-black/40 px-4 py-3 text-sm text-white focus:outline-none"
            placeholder="AI 상담에게 궁금한 내용을 입력하세요"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button type="button" onClick={handleChat} className="btn-gradient px-6" disabled={loading === "/api/ai/chat"}>
            상담
          </button>
        </div>
      </div>

      <div className="glass-panel space-y-3 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-300">AI 상담 기록</p>
            <p className="text-lg font-semibold text-white">내 히스토리</p>
          </div>
          <button
            type="button"
            onClick={fetchHistory}
            disabled={historyLoading || !token}
            className="text-sm text-pink-200 hover:text-pink-100 disabled:opacity-50"
          >
            새로고침
          </button>
        </div>
        {!token && <p className="text-sm text-gray-400">로그인 후 상담 기록이 저장됩니다.</p>}
        {historyLoading && <p className="text-sm text-gray-300">상담 기록을 불러오는 중...</p>}
        {!historyLoading && savedHistory.length === 0 && token && <p className="text-sm text-gray-400">아직 저장된 상담 기록이 없습니다.</p>}
        <div className="space-y-3">
          {savedHistory.map((item, idx) => (
            <div key={idx} className="rounded-xl border border-white/5 bg-white/5 p-4">
              <div className="flex items-center justify-between text-xs text-gray-300">
                <span>Q&A</span>
                <span>{formatDate(item.createdAt)}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-white">Q. {item.question}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-100">A. {item.answer}</p>
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

  return (
    <section className="relative min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black px-6 pb-20 pt-28 text-white lg:px-10">
      <div className="glow-orb absolute -left-24 top-8 h-72 w-72 rounded-full bg-pink-500/30 animate-float-slow" />
      <div className="glow-orb absolute right-0 top-20 h-96 w-80 rounded-full bg-indigo-500/20 pulse-glow" />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-12 lg:flex-row">
        <div className="flex-1 space-y-6">
          <div className="flex flex-wrap gap-3">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab.id ? "bg-white/80 text-gray-900" : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-300">{tabs.find((t) => t.id === activeTab)?.description}</p>
          {error && <p className="rounded-xl bg-red-500/20 px-4 py-2 text-sm text-red-200">{error}</p>}
          {renderActiveTab()}
        </div>

        <div className="flex-1 space-y-6">
          <div className="glass-panel p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-300">실시간 AI 활용</p>
                <p className="text-2xl font-semibold">AI Lab</p>
              </div>
              <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs text-emerald-200">LIVE</span>
            </div>
            <div className="mt-6 space-y-4">
              {liveTiles.map((tile) => (
                <div key={tile.title} className={`rounded-2xl border border-white/5 bg-gradient-to-r ${tile.color} p-4 backdrop-blur`}>
                  <div className="flex items-center justify-between text-xs text-gray-200">
                    <span className="font-semibold uppercase tracking-wide">{tile.tag}</span>
                    <span>{tile.status}</span>
                  </div>
                  <p className="mt-1 text-lg font-semibold text-white">{tile.title}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="glass-panel space-y-4 p-6">
            <p className="text-sm text-gray-300">AI 스냅숏</p>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "분석 응답", value: "3초" },
                { label: "대화 응답", value: "1회" },
                { label: "루틴 생성", value: "1.8s" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-white/5 p-4 text-center">
                  <p className="text-2xl font-semibold text-white">{item.value}</p>
                  <p className="text-xs text-gray-400">{item.label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400">AI 성능은 네트워크와 서버 상태에 따라 달라질 수 있습니다.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

interface InputProps {
  label: string;
  name: string;
  value: string;
  onChange: (updater: any) => void;
  textarea?: boolean;
  required?: boolean;
}

const Input = ({ label, name, value, onChange, textarea, required }: InputProps) => (
  <label className="text-sm text-gray-200">
    {label}
    {textarea ? (
      <textarea
        name={name}
        className="mt-2 w-full rounded-2xl bg-black/30 px-4 py-3 text-white focus:outline-none"
        value={value}
        onChange={(e) => onChange((prev: any) => ({ ...prev, [name]: e.target.value }))}
        rows={3}
        required={required}
      />
    ) : (
      <input
        type="text"
        name={name}
        className="mt-2 w-full rounded-2xl bg-black/30 px-4 py-3 text-white focus:outline-none"
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
  <label className="text-sm text-gray-200">
    {label}
    <select
      name={name}
      value={value}
      onChange={(e) => onChange((prev: any) => ({ ...prev, [name]: e.target.value }))}
      className="mt-2 w-full rounded-2xl bg-black/30 px-4 py-3 text-white focus:outline-none"
    >
      {options.map((option) => (
        <option key={option} value={option} className="bg-gray-800 text-white">
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

const ResultCard = ({ title, content }: ResultCardProps) => (
  <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5 text-sm text-gray-100">
    <h3 className="text-lg font-semibold text-white">{title}</h3>
    <pre className="mt-3 whitespace-pre-wrap leading-relaxed">{content}</pre>
  </div>
);

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return iso;
  }
};
