import { useEffect, useMemo, useRef, useState } from "react";

type Msg = { id: string; role: "user" | "system"; text: string; at: number };

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

  const greeting = useMemo<Msg>(() => ({ id: "greet", role: "system", text: "무엇을 도와드릴까요? 문의를 남겨주시면 확인 후 연락드립니다.", at: Date.now() }), []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text, at: Date.now() };
    setMsgs((m) => [...m, userMsg]);

    try {
      setSending(true);
      const token = localStorage.getItem("token");
      const userRaw = localStorage.getItem("user");
      const user = userRaw ? JSON.parse(userRaw) as { id?: number; email?: string; nickname?: string } : null;
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/support/inquiries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: user?.nickname ?? undefined,
          email: user?.email ?? undefined,
          userId: user?.id ?? undefined,
          message: text,
          page: window.location.pathname,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "system", text: "접수되었습니다. 빠르게 확인 후 답변드릴게요!", at: Date.now() }]);
    } catch (err: any) {
      setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "system", text: `전송 실패: ${err?.message ?? "오류"}`, at: Date.now() }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        aria-label="문의하기"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg hover:opacity-90"
      >
        {open ? "×" : "?"}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 md:w-96 rounded-2xl overflow-hidden bg-gray-900/95 backdrop-blur border border-white/10 shadow-2xl">
          <div className="px-4 py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white font-semibold">문의하기</div>
          <div ref={paneRef} className="max-h-80 overflow-y-auto space-y-3 p-4 text-sm">
            {[greeting, ...msgs].map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`${m.role === "user" ? "bg-pink-600 text-white" : "bg-white/10 text-white"} px-3 py-2 rounded-xl max-w-[85%] whitespace-pre-wrap`}>{m.text}</div>
              </div>
            ))}
          </div>
          <form onSubmit={onSubmit} className="p-3 flex gap-2 border-t border-white/10 bg-gray-900/95">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="메시지를 입력하세요"
              className="flex-1 px-3 py-2 rounded-lg bg-gray-800/70 text-white focus:outline-none"
            />
            <button disabled={sending || !input.trim()} className="px-4 py-2 rounded-lg bg-pink-600 text-white disabled:opacity-50">
              전송
            </button>
          </form>
        </div>
      )}
    </>
  );
}

