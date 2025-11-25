import { useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE;
const USE_CREDENTIALS = import.meta.env.VITE_USE_CREDENTIALS === "true";

const tabs = [
  { id: "analysis", label: "체성 분석", description: "AI가 체성 정보를 분석하고 맞춤 가이드를 제안합니다." },
  { id: "plan", label: "루틴 설계", description: "운동 경험과 장비에 맞춘 4주 루틴을 생성해 보세요." },
  { id: "chat", label: "AI 코치", description: "궁금한 것을 자유롭게 물어보는 챗봇." },
];

const liveTiles = [
  { title: "AI 루틴 분석", tag: "분석", status: "92% 진행", color: "from-emerald-400/20 to-cyan-300/20" },
  { title: "30일 챌린지", tag: "챌린지", status: "DAY 12", color: "from-pink-400/20 to-purple-400/20" },
  { title: "심박 데이터", tag: "실시간", status: "120 bpm", color: "from-blue-400/20 to-indigo-400/20" },
];

interface ChatBubble {
  role: "user" | "assistant";
  content: string;
}

export default function AiFitness() {
  const [activeTab, setActiveTab] = useState("analysis");

  const [analysisForm, setAnalysisForm] = useState({ height: "", weight: "", bodyFat: "", muscleMass: "", goal: "" });
  const [planForm, setPlanForm] = useState({ experienceLevel: "초급", availableDays: "주 3일", focusArea: "상체/체형 개선", equipment: "덤벨, 밴드", preferredTime: "40분", notes: "오전 운동 선호" });
  const [question, setQuestion] = useState("코어를 강화하고 싶은데 어떤 루틴이 좋을까요?");
  const [chatHistory, setChatHistory] = useState<ChatBubble[]>([]);

  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [planResult, setPlanResult] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const token = useMemo(() => localStorage.getItem("token"), []);

  const callAi = async (path: string, payload: unknown) => {
    setLoading(path);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
    const newHistory = [...chatHistory, { role: "user", content: question }];
    setChatHistory(newHistory);
    setQuestion("");
    const data = await callAi("/api/ai/chat", { question, context: newHistory.map((m) => (m.role === "user" ? `사용자: ${m.content}` : `코치: ${m.content}`)).join("\n") });
    setChatHistory((prev) => [...prev, { role: "assistant", content: data.answer ?? JSON.stringify(data) }]);
  };

  const renderAnalysisForm = () => (
    <form onSubmit={handleAnalysis} className="glass-panel space-y-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="키(cm)" name="height" value={analysisForm.height} onChange={setAnalysisForm} required />
        <Input label="몸무게(kg)" name="weight" value={analysisForm.weight} onChange={setAnalysisForm} required />
        <Input label="체지방률(%)" name="bodyFat" value={analysisForm.bodyFat} onChange={setAnalysisForm} />
        <Input label="골격근량(kg)" name="muscleMass" value={analysisForm.muscleMass} onChange={setAnalysisForm} />
      </div>
      <Input label="목표 또는 요청사항" name="goal" value={analysisForm.goal} onChange={setAnalysisForm} textarea />
      <button className="btn-gradient w-full py-3 text-lg" disabled={loading === "/api/ai/analyze"}>
        {loading === "/api/ai/analyze" ? "AI가 분석 중..." : "분석 결과 받기"}
      </button>
      {analysisResult && <ResultCard title="AI 분석 가이드" content={analysisResult} />}
    </form>
  );

  const renderPlanForm = () => (
    <form onSubmit={handlePlan} className="glass-panel space-y-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="운동 경험" name="experienceLevel" value={planForm.experienceLevel} options={["입문", "초급", "중급", "상급"]} onChange={setPlanForm} />
        <Input label="주간 가능 일수" name="availableDays" value={planForm.availableDays} onChange={setPlanForm} />
        <Input label="집중 부위/목표" name="focusArea" value={planForm.focusArea} onChange={setPlanForm} />
        <Input label="사용 장비" name="equipment" value={planForm.equipment} onChange={setPlanForm} />
        <Input label="하루 운동 시간" name="preferredTime" value={planForm.preferredTime} onChange={setPlanForm} />
      </div>
      <Input label="추가 메모" name="notes" value={planForm.notes} onChange={setPlanForm} textarea />
      <button className="btn-gradient w-full py-3 text-lg" disabled={loading === "/api/ai/plan"}>
        {loading === "/api/ai/plan" ? "AI가 루틴을 설계하는 중..." : "맞춤 루틴 받기"}
      </button>
      {planResult && <ResultCard title="AI 루틴 설계" content={planResult} />}
    </form>
  );

  const renderChat = () => (
    <div className="glass-panel flex flex-col gap-4 p-6">
      <div className="max-h-64 space-y-4 overflow-y-auto pr-1">
        {chatHistory.length === 0 && <p className="text-sm text-gray-400">AI 코치에게 무엇이든 질문해 보세요.</p>}
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
          placeholder="AI 코치에게 질문을 입력하세요"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button type="button" onClick={handleChat} className="btn-gradient px-6" disabled={loading === "/api/ai/chat"}>
          전송
        </button>
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
                <p className="text-sm text-gray-300">실시간 AI 활동</p>
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
            <p className="text-sm text-gray-300">AI 모듈 상태</p>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "분석 대기", value: "3건" },
                { label: "생성 중", value: "1건" },
                { label: "응답 속도", value: "1.8s" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-white/5 p-4 text-center">
                  <p className="text-2xl font-semibold text-white">{item.value}</p>
                  <p className="text-xs text-gray-400">{item.label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400">AI 응답은 참고용이며 개인 상황에 따라 전문가의 상담이 필요할 수 있습니다.</p>
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
