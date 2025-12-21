import { useEffect, useState } from "react";

type BragPost = {
  id: number;
  title: string;
  movement?: string | null;
  weight?: string | null;
  likeCount?: number;
};

type BragComment = {
  id: number;
  content: string;
  authorNickname?: string | null;
  createdAt?: string | null;
};

type AiChatLogItem = {
  question: string;
  answer: string;
  createdAt?: string | null;
};

type MyPageResponse = {
  email: string;
  nickname: string;
  recentComments: BragComment[];
  recentLikes: BragPost[];
  recentAiChats: AiChatLogItem[];
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

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

const formatDate = (v?: string | null) => {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default function MyPage() {
  const [data, setData] = useState<MyPageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api<MyPageResponse>("/api/mypage");
        setData(res);
      } catch (e: any) {
        setError(e?.message || "마이페이지 정보를 불러오지 못했어요.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <section className="pt-32 pb-20 px-5 md:px-10 bg-gradient-to-br from-gray-900 via-black to-gray-800 min-h-screen text-white">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.3em] text-pink-300">나의 기록</p>
          <h1 className="text-3xl md:text-4xl font-extrabold">마이페이지</h1>
          {data && (
            <p className="text-gray-300">
              {data.nickname} ({data.email})
            </p>
          )}
        </header>

        {loading && <div className="text-gray-300">불러오는 중...</div>}
        {error && <div className="text-red-400">{error}</div>}

        {data && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-white/5 bg-gray-800/70 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">최근 댓글</h2>
                <span className="text-sm text-gray-400">최대 20개</span>
              </div>
              {data.recentComments.length === 0 && <p className="text-gray-400 text-sm">댓글 기록이 없습니다.</p>}
              <div className="space-y-3">
                {data.recentComments.map((c) => (
                  <div key={c.id} className="rounded-xl bg-gray-900/60 border border-gray-700 p-3">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{c.authorNickname || "익명"}</span>
                      <span>{formatDate(c.createdAt)}</span>
                    </div>
                    <p className="text-gray-200 mt-1 whitespace-pre-line">{c.content}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-gray-800/70 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">좋아요한 자랑</h2>
                <span className="text-sm text-gray-400">최신순</span>
              </div>
              {data.recentLikes.length === 0 && <p className="text-gray-400 text-sm">좋아요 기록이 없습니다.</p>}
              <div className="space-y-3">
                {data.recentLikes.map((p) => (
                  <a
                    key={p.id}
                    href={`/brag/${p.id}`}
                    className="block rounded-xl bg-gray-900/60 border border-gray-700 p-3 hover:border-pink-400/50 transition"
                  >
                    <div className="flex justify-between items-center">
                      <p className="font-semibold text-pink-200">{p.title}</p>
                      <span className="text-sm text-gray-400">❤️ {p.likeCount ?? 0}</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">
                      {p.movement || "-"} {p.weight ? `· ${p.weight}` : ""}
                    </p>
                  </a>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 rounded-2xl border border-white/5 bg-gray-800/70 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">AI 이용 이력</h2>
                <span className="text-sm text-gray-400">최근 20개</span>
              </div>
              {data.recentAiChats.length === 0 && <p className="text-gray-400 text-sm">AI 기록이 없습니다.</p>}
              <div className="grid md:grid-cols-2 gap-3">
                {data.recentAiChats.map((item, idx) => (
                  <div key={idx} className="rounded-xl bg-gray-900/60 border border-gray-700 p-3 space-y-1">
                    <div className="text-xs text-gray-500">{formatDate(item.createdAt)}</div>
                    <p className="text-sm font-semibold text-white">Q. {item.question}</p>
                    <p className="text-sm text-gray-200 whitespace-pre-line">A. {item.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
