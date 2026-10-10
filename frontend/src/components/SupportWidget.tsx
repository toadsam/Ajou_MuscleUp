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

      // 홈의 모바일 하단 고정바는 이름으로도 직접 찾는다(높이 약 80px).
      const homeDock = document.querySelector<HTMLElement>(".mobile-fixed-actions");
      if (homeDock && window.getComputedStyle(homeDock).display !== "none") {
        const rect = homeDock.getBoundingClientRect();
        if (rect.height > 0 && rect.bottom >= vh - 28) fixedNodes.push(homeDock);
      }

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
      // 하단 고정바가 있으면 그 위로 16px 띄워서 버튼이 겹치지 않게 한다.
      const nextBottom = dockHeight > 0 ? Math.min(220, dockHeight + 16) : 24;
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
        type="button"
        aria-label={open ? "문의창 닫기" : "문의하기"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="fixed right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-black bg-steel-700 text-chalk shadow-md transition hover:-translate-y-0.5 hover:bg-steel-600 active:translate-y-1 active:shadow-none sm:right-6"
        style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + ${fabBottom}px)` }}
        data-support-widget="true"
      >
        {/* 원판 가운데 구멍 같은 안쪽 테두리 */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-1 rounded-full border border-black/50" />
        {open ? (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <span aria-hidden="true" className="font-num text-2xl leading-none">?</span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`${BOT_NAME} 홈페이지 안내`}
          className="dg-steel dg-rise fixed right-4 z-50 w-[calc(100vw-2rem)] max-w-[24rem] overflow-hidden sm:right-6 sm:w-80 md:w-96"
          style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + ${fabBottom + 60}px)` }}
          data-support-widget="true"
        >
          <div className="flex items-center gap-2 border-b-[3px] border-black bg-steel-900 px-4 py-3 font-semibold text-chalk">
            <span aria-hidden="true" className="h-3 w-3 rounded-full border-2 border-black bg-plate-red" />
            <span>
              {BOT_NAME} <span className="text-steel-400">|</span> 홈페이지 안내
            </span>
            {sending && <span className="ml-auto text-xs font-medium text-plate-yellow">답변 준비 중...</span>}
          </div>

          <div className="border-b-2 border-black p-4">
            <div className="flex items-start gap-3">
              <DeukgeunAvatar />
              <div className="min-w-0">
                <p className="text-sm font-bold text-chalk">{BOT_NAME} 캐릭터</p>
                <p className="mt-1 text-xs text-steel-300">어디로 들어가야 할지 헷갈릴 때, 버튼 누르면 바로 이동 경로를 알려드려요.</p>
              </div>
            </div>
            <div className="mt-3 flex max-h-24 flex-wrap gap-2 overflow-y-auto pr-1">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void sendQuestion(q)}
                  disabled={sending}
                  className="rounded-md border-2 border-black bg-steel-700 px-2.5 py-1 text-xs text-chalk shadow-[0_2px_0_#0E0E10] transition hover:-translate-y-px hover:bg-steel-600 active:translate-y-0.5 active:shadow-none disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>

            <div className="dg-well mt-3 p-2.5">
              <p className="text-xs font-semibold text-plate-yellow">득근득근 회장에게 하고 싶은 말</p>
              <textarea
                value={chairmanMessage}
                onChange={(e) => setChairmanMessage(e.target.value)}
                placeholder="건의, 칭찬, 불편사항을 편하게 적어주세요."
                aria-label="득근득근 회장에게 하고 싶은 말"
                className="mt-2 h-16 w-full resize-none rounded-md border-2 border-black bg-steel-900 px-2 py-1.5 text-xs text-chalk placeholder:text-steel-500 focus:outline-none focus-visible:border-plate-yellow"
                disabled={chairmanSending}
              />
              <button
                type="button"
                onClick={() => void submitChairmanMessage()}
                disabled={chairmanSending || !chairmanMessage.trim()}
                className="dg-btn dg-btn-primary mt-2 w-full px-3 py-1.5 text-xs"
              >
                {chairmanSending ? "전송 중..." : "회장님께 전달하기"}
              </button>
            </div>
          </div>

          <div ref={paneRef} className="max-h-80 space-y-3 overflow-y-auto p-4 text-sm">
            {[greeting, ...msgs].map((m) => (
              <div key={m.id} className={`dg-rise flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] whitespace-pre-wrap rounded-lg border-2 border-black px-3 py-2 ${
                    m.role === "user" ? "bg-plate-red text-white" : "bg-steel-700 text-chalk"
                  }`}
                >
                  {m.role === "system" ? <SystemMessageText text={m.text} /> : m.text}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-lg border-2 border-black bg-steel-700 px-3 py-2 text-chalk">
                  <p className="text-xs text-steel-300">{BOT_NAME}가 답변 준비 중...</p>
                  <span className="dg-loading-plates mt-1 scale-75 origin-left" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={onSubmit} className="flex gap-2 border-t-[3px] border-black bg-steel-900 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`예: ${BOT_NAME}, 친구 채팅 어디서 해요?`}
              aria-label="질문 입력"
              disabled={sending}
              className="min-w-0 flex-1 rounded-md border-2 border-black bg-steel-800 px-3 py-2 text-chalk placeholder:text-steel-500 focus:outline-none focus-visible:border-plate-yellow disabled:opacity-60"
            />
            <button disabled={sending || !input.trim()} className="dg-btn dg-btn-primary px-4 py-2 text-sm">
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
              className="inline-flex items-center gap-1 rounded-md border-2 border-black bg-plate-blue px-2 py-1 text-xs font-semibold text-white shadow-[0_2px_0_#0E0E10] transition hover:-translate-y-px active:translate-y-0.5 active:shadow-none"
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
    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-[3px] border-black bg-plate-blue shadow-sm">
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
        <rect x="0" y="0" width="64" height="64" fill="#2F6FD0" />
        <circle cx="32" cy="26" r="13" fill="#F0BE2E" stroke="#0E0E10" strokeWidth="2" />
        <rect x="19" y="40" width="26" height="12" rx="6" fill="#0E0E10" />
        <circle cx="27" cy="25" r="2" fill="#0E0E10" />
        <circle cx="37" cy="25" r="2" fill="#0E0E10" />
        <path d="M27 30c1.4 1.6 3 2.3 5 2.3s3.6-.7 5-2.3" stroke="#0E0E10" strokeWidth="2" fill="none" strokeLinecap="round" />
        <rect x="8" y="42" width="8" height="8" rx="2" fill="#D9302A" stroke="#0E0E10" strokeWidth="1.5" />
        <rect x="48" y="42" width="8" height="8" rx="2" fill="#D9302A" stroke="#0E0E10" strokeWidth="1.5" />
        <rect x="16" y="45" width="8" height="2" fill="#EEECE6" />
        <rect x="40" y="45" width="8" height="2" fill="#EEECE6" />
      </svg>
    </div>
  );
}

