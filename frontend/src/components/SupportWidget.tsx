import { useEffect, useMemo, useRef, useState } from "react";

type Msg = { id: string; role: "user" | "system"; text: string; at: number };

type SupportChatResponse = {
  answer?: string;
};

type SupportInquiryResponse = {
  id?: number;
};

type LocalUser = {
  id?: number;
  nickname?: string;
  email?: string;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const BOT_NAME = "득근이";
const SUGGESTED_QUESTIONS = [
  "출석 체크는 어디서 하나요?",
  "친구랑 1:1 채팅은 어디로 들어가요?",
  "인바디 분석은 어디에서 해요?",
  "AI 플래너로 운동 루틴 짜는 방법 알려줘",
  "크루(모임) 만들려면 어디로 가야 해요?",
  "랭킹은 어디에서 볼 수 있나요?",
  "자랑방 글은 어디서 써요?",
  "출석 공유 이미지 저장은 어디서 하나요?",
  "내 캐릭터/외형 바꾸는 메뉴가 어디예요?",
  "마이페이지는 어디에서 들어가요?",
  "이벤트 신청은 어디에서 하나요?",
  "단백질 공동구매/리뷰는 어디서 보나요?",
  "로그인은 어디서 해요?",
  "회원가입은 어디서 해요?",
  "홈 화면으로 바로 가고 싶어요",
  "득근득근 회장에게 하고 싶은 말 보내고 싶어요",
];

const LINK_REGEX = /\[([^\]]+)\]\((\/[^)]+)\)/g;

export default function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [fabBottom, setFabBottom] = useState(24);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chairmanMessage, setChairmanMessage] = useState("");
  const [chairmanSending, setChairmanSending] = useState(false);
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
  }, [open, msgs, sending]);

  useEffect(() => {
    const detectBottomDockHeight = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const fixedNodes = Array.from(document.querySelectorAll<HTMLElement>("body *")).filter((el) => {
        if (el.dataset.supportWidget === "true") return false;
        const style = window.getComputedStyle(el);
        if (style.position !== "fixed") return false;
        if (style.display === "none" || style.visibility === "hidden") return false;
        const rect = el.getBoundingClientRect();
        if (rect.width < vw * 0.45 || rect.height < 36) return false;
        if (rect.top < vh * 0.55) return false;
        return rect.bottom >= vh - 28;
      });

      if (!fixedNodes.length) return 0;
      return Math.max(
        ...fixedNodes.map((el) => {
          const rect = el.getBoundingClientRect();
          return Math.max(0, vh - rect.top);
        })
      );
    };

    const updateFabOffset = () => {
      if (window.innerWidth >= 640) {
        setFabBottom(24);
        return;
      }
      const dockHeight = detectBottomDockHeight();
      const nextBottom = dockHeight > 0 ? Math.min(220, 24 + dockHeight + 12) : 24;
      setFabBottom(nextBottom);
    };

    updateFabOffset();
    window.addEventListener("resize", updateFabOffset);
    window.addEventListener("scroll", updateFabOffset, { passive: true });
    const observer = new MutationObserver(updateFabOffset);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    return () => {
      window.removeEventListener("resize", updateFabOffset);
      window.removeEventListener("scroll", updateFabOffset);
      observer.disconnect();
    };
  }, []);

  const greeting = useMemo<Msg>(
    () => ({
      id: "greet",
      role: "system",
      text: `안녕하세요, ${BOT_NAME}예요.\n궁금한 기능을 아래 질문 버튼으로 눌러도 바로 안내해드릴게요.`,
      at: Date.now(),
    }),
    []
  );

  const appendUserMessage = (text: string) => {
    setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "user", text, at: Date.now() }]);
  };

  const appendSystemMessage = (text: string) => {
    setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "system", text, at: Date.now() }]);
  };

  const sendQuestion = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || sending) return;

    appendUserMessage(text);

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
      appendSystemMessage(answer);
    } catch (err: any) {
      appendSystemMessage(`${BOT_NAME}: 안내 응답에 잠깐 문제가 생겼어요. (${err?.message ?? "오류"})\n잠시 후 다시 시도해 주세요.`);
    } finally {
      setSending(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    await sendQuestion(text);
  };

  const submitChairmanMessage = async () => {
    const text = chairmanMessage.trim();
    if (!text || chairmanSending) return;

    const user = loadLocalUser();
    try {
      setChairmanSending(true);
      const res = await fetch(`${API_BASE}/api/support/inquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: user?.nickname || "익명",
          email: user?.email || null,
          message: text,
          page: `chairman-feedback:${window.location.pathname}`,
          userId: user?.id ?? null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await res.json() as SupportInquiryResponse;
      setChairmanMessage("");
      appendSystemMessage("회장님께 한마디를 전달했어요. 운영진이 확인 후 반영하겠습니다.");
    } catch (err: any) {
      appendSystemMessage(`회장님 메시지 전송에 실패했어요. (${err?.message ?? "오류"})`);
    } finally {
      setChairmanSending(false);
    }
  };

  return (
    <>
      <button
        aria-label="문의하기"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg hover:opacity-90"
        style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + ${fabBottom}px)` }}
        data-support-widget="true"
      >
        {open ? "X" : "?"}
      </button>

      {open && (
        <div
          className="fixed right-6 z-50 w-80 overflow-hidden rounded-2xl border border-white/10 bg-gray-900/95 shadow-2xl backdrop-blur md:w-96"
          style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + ${fabBottom + 68}px)` }}
          data-support-widget="true"
        >
          <div className="bg-gradient-to-r from-pink-600 to-purple-600 px-4 py-3 font-semibold text-white">
            {BOT_NAME} | 홈페이지 안내
            {sending && <span className="ml-2 text-xs font-medium text-pink-100">답변 준비 중...</span>}
          </div>

          <div className="border-b border-white/10 bg-gradient-to-br from-[#1b2440] to-[#0f172a] p-4">
            <div className="flex items-start gap-3">
              <DeukgeunAvatar />
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">{BOT_NAME} 캐릭터</p>
                <p className="mt-1 text-xs text-slate-200">어디로 들어가야 할지 헷갈릴 때, 버튼 누르면 바로 이동 경로를 알려드려요.</p>
              </div>
            </div>
            <div className="mt-3 flex max-h-24 flex-wrap gap-2 overflow-y-auto pr-1">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void sendQuestion(q)}
                  disabled={sending}
                  className="rounded-full border border-fuchsia-300/40 bg-fuchsia-500/10 px-3 py-1 text-xs text-fuchsia-100 hover:bg-fuchsia-500/20 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>

            <div className="mt-3 rounded-xl border border-white/15 bg-white/5 p-2">
              <p className="text-xs font-semibold text-pink-200">득근득근 회장에게 하고 싶은 말</p>
              <textarea
                value={chairmanMessage}
                onChange={(e) => setChairmanMessage(e.target.value)}
                placeholder="건의, 칭찬, 불편사항을 편하게 적어주세요."
                className="mt-2 h-16 w-full resize-none rounded-lg bg-slate-900/70 px-2 py-1.5 text-xs text-white focus:outline-none"
                disabled={chairmanSending}
              />
              <button
                type="button"
                onClick={() => void submitChairmanMessage()}
                disabled={chairmanSending || !chairmanMessage.trim()}
                className="mt-2 w-full rounded-lg bg-pink-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {chairmanSending ? "전송 중..." : "회장님께 전달하기"}
              </button>
            </div>
          </div>

          <div ref={paneRef} className="max-h-80 space-y-3 overflow-y-auto p-4 text-sm">
            {[greeting, ...msgs].map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] whitespace-pre-wrap rounded-xl px-3 py-2 ${
                    m.role === "user" ? "bg-pink-600 text-white" : "bg-white/10 text-white"
                  }`}
                >
                  {m.role === "system" ? <SystemMessageText text={m.text} /> : m.text}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-xl bg-white/10 px-3 py-2 text-white">
                  <p className="text-xs text-slate-200">{BOT_NAME}가 답변 준비 중...</p>
                  <div className="mt-1 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-pink-300 [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-pink-300 [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-pink-300 [animation-delay:240ms]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={onSubmit} className="flex gap-2 border-t border-white/10 bg-gray-900/95 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`예: ${BOT_NAME}, 친구 채팅 어디서 해요?`}
              disabled={sending}
              className="flex-1 rounded-lg bg-gray-800/70 px-3 py-2 text-white focus:outline-none disabled:opacity-60"
            />
            <button
              disabled={sending || !input.trim()}
              className="rounded-lg bg-pink-600 px-4 py-2 text-white disabled:opacity-50"
            >
              {sending ? "답변 중" : "전송"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function SystemMessageText({ text }: { text: string }) {
  const links = extractLinks(text);
  const normalizedText = text
    .replace(LINK_REGEX, "$1")
    .replace(/관련\s*경로\s*:/g, "바로 이동")
    .trim();

  return (
    <div className="space-y-2">
      <p className="whitespace-pre-wrap">{normalizedText}</p>
      {links.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {links.map((link) => (
            <a
              key={`${link.label}-${link.href}`}
              href={link.href}
              className="rounded-full border border-cyan-300/40 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-500/20"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function extractLinks(text: string): Array<{ label: string; href: string }> {
  const links: Array<{ label: string; href: string }> = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(LINK_REGEX)) {
    const label = (match[1] || "바로가기").trim();
    const href = (match[2] || "/").trim();
    const key = `${label}::${href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ label, href });
  }
  return links;
}

function loadLocalUser(): LocalUser | null {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    return JSON.parse(raw) as LocalUser;
  } catch {
    return null;
  }
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

