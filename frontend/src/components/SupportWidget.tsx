import { useEffect, useMemo, useRef, useState } from "react";

type Msg = { id: string; role: "user" | "system"; text: string; at: number };

type SupportChatResponse = {
  answer?: string;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const BOT_NAME = "득근이";
const SUGGESTED_QUESTIONS = [
  "인바디 분석 어디서 해요?",
  "친구 채팅은 어디에서 해요?",
  "출석 체크는 어디서 하나요?",
];

export default function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    const raw = localStorage.getItem("support_msgs");
    return raw ? (JSON.parse(raw) as Msg[]) : [];
  });
  const paneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("support_msgs", JSON.stringify(msgs));
  }, [msgs]);

  useEffect(() => {
    if (open && paneRef.current) {
      paneRef.current.scrollTop = paneRef.current.scrollHeight;
    }
  }, [open, msgs]);

  const greeting = useMemo<Msg>(
    () => ({
      id: "greet",
      role: "system",
      text: `안녕하세요, ${BOT_NAME}예요.\n궁금한 기능 물어보시면 홈페이지 경로까지 빠르게 안내해드릴게요.`,
      at: Date.now(),
    }),
    []
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    setInput("");
    setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "user", text, at: Date.now() }]);

    try {
      setSending(true);
      const res = await fetch(`${API_BASE}/api/support/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: text,
          page: window.location.pathname,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = (await res.json()) as SupportChatResponse;
      const answer = data.answer?.trim() || `${BOT_NAME}: 질문을 정확히 이해하지 못했어요. 다른 표현으로 다시 물어봐 주세요.`;
      setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "system", text: answer, at: Date.now() }]);
    } catch (err: any) {
      setMsgs((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "system",
          text: `${BOT_NAME}: 안내 응답에 잠깐 문제가 생겼어요. (${err?.message ?? "오류"})\n잠시 후 다시 시도해 주세요.`,
          at: Date.now(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        aria-label="문의하기"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg hover:opacity-90"
      >
        {open ? "X" : "?"}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 overflow-hidden rounded-2xl border border-white/10 bg-gray-900/95 shadow-2xl backdrop-blur md:w-96">
          <div className="bg-gradient-to-r from-pink-600 to-purple-600 px-4 py-3 font-semibold text-white">{BOT_NAME} | 홈페이지 안내</div>
          <div className="border-b border-white/10 bg-gradient-to-br from-[#1b2440] to-[#0f172a] p-4">
            <div className="flex items-start gap-3">
              <DeukgeunAvatar />
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">{BOT_NAME} 캐릭터</p>
                <p className="mt-1 text-xs text-slate-200">
                  경로 안내 특화 도우미입니다. 메뉴 위치를 빠르게 찾아드려요.
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setInput(q)}
                  className="rounded-full border border-fuchsia-300/40 bg-fuchsia-500/10 px-3 py-1 text-xs text-fuchsia-100 hover:bg-fuchsia-500/20"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
          <div ref={paneRef} className="max-h-80 space-y-3 overflow-y-auto p-4 text-sm">
            {[greeting, ...msgs].map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 ${
                    m.role === "user" ? "bg-pink-600 text-white" : "bg-white/10 text-white"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={onSubmit} className="flex gap-2 border-t border-white/10 bg-gray-900/95 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`예: ${BOT_NAME}, 인바디 분석 어디서 해요?`}
              className="flex-1 rounded-lg bg-gray-800/70 px-3 py-2 text-white focus:outline-none"
            />
            <button disabled={sending || !input.trim()} className="rounded-lg bg-pink-600 px-4 py-2 text-white disabled:opacity-50">
              전송
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function DeukgeunAvatar() {
  return (
    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/20 bg-slate-800">
      <svg viewBox="0 0 64 64" className="h-full w-full">
        <defs>
          <linearGradient id="dg-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="64" height="64" fill="url(#dg-bg)" />
        <circle cx="32" cy="26" r="13" fill="#fde68a" />
        <rect x="19" y="40" width="26" height="12" rx="6" fill="#111827" />
        <circle cx="27" cy="25" r="2" fill="#0f172a" />
        <circle cx="37" cy="25" r="2" fill="#0f172a" />
        <path d="M27 30c1.4 1.6 3 2.3 5 2.3s3.6-.7 5-2.3" stroke="#0f172a" strokeWidth="2" fill="none" strokeLinecap="round" />
        <rect x="8" y="42" width="8" height="8" rx="2" fill="#cbd5e1" />
        <rect x="48" y="42" width="8" height="8" rx="2" fill="#cbd5e1" />
        <rect x="16" y="45" width="8" height="2" fill="#e2e8f0" />
        <rect x="40" y="45" width="8" height="2" fill="#e2e8f0" />
      </svg>
    </div>
  );
}
