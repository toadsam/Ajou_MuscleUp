import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useCountUp } from "../hooks/useCountUp";

function CountNumber({ value, digits = 0 }: { value: number; digits?: number }) {
  const v = useCountUp(value, { duration: 900 });
  return <>{digits > 0 ? v.toFixed(digits) : Math.round(v).toLocaleString()}</>;
}

type Protein = {
  id: number;
  name: string;
  price?: number;
  days?: number;
  goal?: number;
  imageUrl?: string;
  description?: string;
  category?: string;
  avgRating?: number | null;
  ownerEmail?: string | null;
  ownerNickname?: string | null;
};

type ApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";

type Application = {
  id: number;
  userId: number;
  userNickname: string;
  status: ApplicationStatus;
  createdAt: string;
};

type Summary = {
  pendingCount: number;
  approvedCount: number;
};

type Message = {
  id: number;
  userId: number;
  userNickname: string;
  content: string;
  createdAt: string;
};

const BASE = import.meta.env.VITE_API_BASE ?? "";

const formatPrice = (value?: number) => (typeof value === "number" ? `${value.toLocaleString()}원` : "미정");

const parseLocation = (category?: string) => {
  if (!category) return { region: "미지정", gym: "미지정" };
  const [regionRaw, gymRaw] = category.split("/");
  return {
    region: (regionRaw || "").trim() || "미지정",
    gym: (gymRaw || "").trim() || "미지정",
  };
};

const getDistributionType = (description?: string) => {
  if (!description) return "직접 만남";
  if (description.includes("보관함")) return "헬스장 보관함";
  if (description.includes("직접")) return "직접 만남";
  return "직접 만남";
};

const getStatus = (days?: number, rating?: number | null) => {
  if (typeof days === "number" && days <= 0) {
    return (rating ?? 0) > 0 ? "분배완료" : "모집완료";
  }
  return "모집중";
};

const statusSteps = ["모집중", "모집완료", "분배완료"] as const;

const findMetaLine = (description?: string, key?: string) => {
  if (!description || !key) return null;
  const regex = new RegExp(`${key}\\s*[:：]\\s*(.+)$`, "im");
  const match = description.match(regex);
  return match?.[1]?.trim() || null;
};

const formatDate = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const url = BASE ? `${BASE}${path}` : path;
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

export default function ProteinDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<Protein | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary>({ pendingCount: 0, approvedCount: 0 });
  const [myApplication, setMyApplication] = useState<Application | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [loadingApps, setLoadingApps] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);

  const userRaw = localStorage.getItem("user");
  const user = userRaw ? (JSON.parse(userRaw) as { email?: string; role?: string }) : null;
  const isAdmin = (user?.role || "").includes("ADMIN");

  const isOwner = useMemo(() => {
    return !!user?.email && !!data?.ownerEmail && user.email === data.ownerEmail;
  }, [user, data]);

  const canAccessChat = useMemo(() => {
    return isAdmin || isOwner || myApplication?.status === "APPROVED";
  }, [isAdmin, isOwner, myApplication]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        const url = (BASE ? `${BASE}` : "") + `/api/proteins/${id}`;
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: Protein = await res.json();
        setData(json);
      } catch (e: any) {
        setErr(e.message ?? "불러오기에 실패했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    api<Summary>(`/api/proteins/${id}/applications/summary`)
      .then(setSummary)
      .catch(() => setSummary({ pendingCount: 0, approvedCount: 0 }));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    api<Application>(`/api/proteins/${id}/applications/me`)
      .then(setMyApplication)
      .catch(() => setMyApplication(null));
  }, [id]);

  useEffect(() => {
    if (!id || (!isOwner && !isAdmin)) return;
    setLoadingApps(true);
    api<Application[]>(`/api/proteins/${id}/applications`)
      .then(setApplications)
      .catch(() => setApplications([]))
      .finally(() => setLoadingApps(false));
  }, [id, isOwner, isAdmin]);

  useEffect(() => {
    if (!id || !canAccessChat) return;
    setLoadingChat(true);
    api<Message[]>(`/api/proteins/${id}/chat/messages`)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoadingChat(false));
  }, [id, canAccessChat]);

  const handleApply = async () => {
    if (!id) return;
    try {
      const applied = await api<Application>(`/api/proteins/${id}/applications`, { method: "POST" });
      setMyApplication(applied);
      const latest = await api<Summary>(`/api/proteins/${id}/applications/summary`);
      setSummary(latest);
    } catch (e: any) {
      alert(e?.message || "신청에 실패했습니다.");
    }
  };

  const updateStatus = async (appId: number, status: ApplicationStatus) => {
    if (!id) return;
    try {
      const updated = await api<Application>(
        `/api/proteins/${id}/applications/${appId}?status=${status}`,
        { method: "PATCH" }
      );
      setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      const latest = await api<Summary>(`/api/proteins/${id}/applications/summary`);
      setSummary(latest);
    } catch (e: any) {
      alert(e?.message || "상태 변경에 실패했습니다.");
    }
  };

  const sendMessage = async () => {
    if (!id || !messageInput.trim()) return;
    try {
      const next = await api<Message>(`/api/proteins/${id}/chat/messages`, {
        method: "POST",
        body: JSON.stringify({ content: messageInput.trim() }),
      });
      setMessages((prev) => [...prev, next]);
      setMessageInput("");
    } catch (e: any) {
      alert(e?.message || "메시지 전송에 실패했습니다.");
    }
  };

  if (loading) {
    return (
      <section className="pt-28 px-6 lg:px-12 min-h-screen text-white">
        <p className="flex items-center justify-center gap-3 text-center text-steel-300">
          <span className="dg-loading-plates" aria-label="불러오는 중">
          <i />
          <i />
          <i />
          <i />
        </span>
          불러오는 중...
        </p>
      </section>
    );
  }

  if (err || !data) {
    return (
      <section className="pt-28 px-6 lg:px-12 min-h-screen text-white">
        <div className="dg-steel max-w-3xl mx-auto p-8">
          <p className="text-red-300 mb-6">{err ?? "데이터를 찾을 수 없습니다."}</p>
          <button
            onClick={() => navigate(-1)}
            className="dg-btn dg-btn-steel"
          >
            이전으로
          </button>
        </div>
      </section>
    );
  }

  const rating = data.avgRating ?? 0;
  const status = getStatus(data.days, data.avgRating);
  const perPrice =
    typeof data.price === "number" && typeof data.goal === "number" && data.goal > 0
      ? Math.ceil(data.price / data.goal)
      : null;
  const target = data.goal ?? 4;
  const approved = summary.approvedCount;
  const pending = summary.pendingCount;
  const { region, gym } = parseLocation(data.category);
  const distributionType = getDistributionType(data.description);
  const distributionSpot =
    findMetaLine(data.description, "분배 위치") ||
    findMetaLine(data.description, "분배위치") ||
    "협의 중";
  const totalCapacity = findMetaLine(data.description, "총 용량") || (data.goal ? `${data.goal}인분` : "미정");
  const perCapacity = findMetaLine(data.description, "1인 분배") || (data.goal ? "균등 분배" : "미정");
  const brand = findMetaLine(data.description, "브랜드") || data.name.split(" ")[0] || "브랜드 미정";

  return (
    <section className="pt-24 pb-16 px-6 lg:px-12 min-h-screen text-white">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="dg-chip bg-plate-green text-sm text-white">{region}</span>
          <span className="dg-chip bg-orange-500 text-sm text-black">{gym}</span>
          <span className="text-xs text-steel-400">지역 또는 헬스장 기반 나눔 모집글</span>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-6">
            <div className="dg-steel p-6 space-y-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-steel-400">{brand}</p>
                  <h1 className="text-3xl md:text-4xl">{data.name}</h1>
                  <p className="text-xs text-steel-400 mt-1">작성자: {data.ownerNickname || "익명"}</p>
                </div>
                <div className="text-right text-sm text-steel-300">
                  <p>
                    상태: <span className="dg-chip bg-plate-yellow text-sm text-black">{status}</span>
                  </p>
                  <p>{data.days ? `마감까지 ${data.days}일` : "마감 일정 미정"}</p>
                </div>
              </div>

              <div className="flex gap-1.5">
                {statusSteps.map((step, idx) => {
                  const isActive = statusSteps.indexOf(step) <= statusSteps.indexOf(status as typeof step);
                  return (
                    <div key={step} className="flex-1">
                      <div
                        className={`dg-plate-in h-3 rounded-sm border-2 border-black ${isActive ? "bg-plate-green" : "bg-steel-900"}`}
                        style={{ animationDelay: `${idx * 120}ms` }}
                      />
                      <p className={`mt-1 text-center text-xs font-semibold ${isActive ? "text-green-300" : "text-steel-500"}`}>{step}</p>
                    </div>
                  );
                })}
              </div>

              {data.imageUrl && (
                <img src={data.imageUrl} alt={data.name} className="w-full h-72 object-cover rounded-lg border-[3px] border-black" />
              )}

              <div className="grid md:grid-cols-2 gap-4 text-sm text-steel-200">
                <div className="dg-well p-4 space-y-1">
                  <p className="text-xs text-steel-400">실제 구매 가격</p>
                  <p className="font-num text-2xl font-black">{formatPrice(data.price)}</p>
                </div>
                <div className="dg-well p-4 space-y-1">
                  <p className="text-xs text-steel-400">1인 부담 금액</p>
                  <p className="font-num text-2xl font-black text-plate-yellow">{perPrice ? <><CountNumber value={perPrice} />원</> : "미정"}</p>
                </div>
                <div className="dg-well p-4 space-y-1">
                  <p className="text-xs text-steel-400">총 용량</p>
                  <p className="text-lg font-semibold">{totalCapacity}</p>
                </div>
                <div className="dg-well p-4 space-y-1">
                  <p className="text-xs text-steel-400">1인 분배 용량</p>
                  <p className="text-lg font-semibold">{perCapacity}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 text-sm text-steel-200">
                <div className="dg-well p-4">
                  <p className="text-xs text-steel-400">분배 장소 유형</p>
                  <p className="text-lg font-semibold">{distributionType}</p>
                  <p className="text-xs text-steel-400 mt-2">대략적 위치</p>
                  <p className="text-sm">{distributionSpot}</p>
                </div>
                <div className="dg-well p-4">
                  <p className="text-xs text-steel-400">영수증/실구매 인증</p>
                  {data.imageUrl ? (
                    <img src={data.imageUrl} alt="receipt" className="mt-2 h-32 w-full object-cover rounded border-2 border-black" />
                  ) : (
                    <p className="text-sm mt-2">등록된 인증 이미지가 없습니다.</p>
                  )}
                </div>
              </div>

              {data.description && (
                <div className="dg-well p-4 text-sm text-steel-200 whitespace-pre-wrap">
                  {data.description}
                </div>
              )}
            </div>

            <div className="dg-steel p-6">
              <h2 className="font-display text-xl mb-4">공구 후기 요약</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="dg-well p-4">
                  <p className="text-xs text-steel-400">제품 만족도</p>
                  <p className="font-num text-4xl font-black text-green-300"><CountNumber value={rating} digits={1} /> <span className="text-lg text-steel-400">/ 5</span></p>
                </div>
                <div className="dg-well p-4">
                  <p className="text-xs text-steel-400">재거래 의향</p>
                  <p className="font-num text-4xl font-black text-orange-300"><CountNumber value={Math.round((rating / 5) * 100)} />%</p>
                </div>
              </div>
            </div>

            <div className="dg-steel p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl">공구 소통 공간</h2>
                <span className="text-xs text-steel-400">승인된 참여자 전용</span>
              </div>
              {!canAccessChat && (
                <div className="dg-well p-4 text-xs text-steel-300">
                  승인된 사용자만 소통 공간을 이용할 수 있습니다.
                </div>
              )}
              {canAccessChat && (
                <>
                  <div className="dg-well p-4 max-h-64 overflow-y-auto space-y-3">
                    {loadingChat && <p className="text-xs text-steel-300">불러오는 중...</p>}
                    {!loadingChat && messages.length === 0 && (
                      <p className="text-xs text-steel-300">아직 대화가 없습니다.</p>
                    )}
                    {messages.map((msg) => (
                      <div key={msg.id} className="dg-rise border-l-4 border-steel-600 pl-3 text-sm">
                        <p className="text-xs text-steel-400">
                          {msg.userNickname} · {formatDate(msg.createdAt)}
                        </p>
                        <p className="text-steel-100 whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      className="dg-well flex-1 px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow"
                      placeholder="소통 메시지를 남겨보세요"
                    />
                    <button
                      type="button"
                      onClick={sendMessage}
                      className="dg-btn dg-btn-primary min-h-[44px] px-4 text-sm"
                    >
                      전송
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="dg-steel p-6 space-y-4">
              <h2 className="font-display text-xl">참여 신청</h2>
              <p className="text-sm text-steel-300">결제는 플랫폼 외부에서 진행돼요. 신청 후 승인된 사람만 소통 공간에 입장합니다.</p>
              <div className="dg-well p-4 text-sm text-steel-200">
                <p className="mb-2">
                  목표 <span className="font-num text-lg font-black">{target}</span>명 중{" "}
                  <span key={approved} className="dg-pop font-num inline-block text-lg font-black text-plate-green">{approved}</span>명 승인
                </p>
                {target <= 12 ? (
                  <div className="flex gap-1" aria-hidden>
                    {Array.from({ length: target }, (_, i) => (
                      <span
                        key={i}
                        className={`h-4 flex-1 rounded-sm border-2 border-black ${i < approved ? "dg-plate-in bg-plate-green" : "bg-steel-800"}`}
                        style={{ animationDelay: `${i * 70}ms` }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="h-4 w-full overflow-hidden rounded-sm border-2 border-black bg-steel-800">
                    <div
                      className="h-full bg-plate-green transition-[width] duration-700 ease-out"
                      style={{ width: `${Math.min(100, Math.round((approved / target) * 100))}%` }}
                    />
                  </div>
                )}
                <p className="text-xs text-steel-400 mt-2">대기 인원 {pending}명</p>
              </div>
              {(isOwner || isAdmin) ? (
                <div className="dg-well p-4 text-xs text-steel-300">
                  {isOwner ? "작성자 계정입니다." : "관리자 계정입니다."}
                </div>
              ) : myApplication ? (
                <div key={myApplication.status} className="dg-pop dg-well border-l-[6px] border-l-plate-yellow p-4 text-xs text-steel-200">
                  신청 상태: {myApplication.status === "PENDING" ? "승인 대기" : myApplication.status === "APPROVED" ? "승인 완료" : "거절"}
                </div>
              ) : (
                <button
                  className="dg-btn dg-btn-primary w-full"
                  onClick={handleApply}
                >
                  참여하기 (신청)
                </button>
              )}
              <div className="dg-well p-4 text-xs text-steel-300">
                승인된 사용자만 공구 전용 소통 공간에 접근할 수 있습니다.
              </div>
            </div>

            {(isOwner || isAdmin) && (
              <div className="dg-steel p-6 space-y-3">
                <h2 className="font-display text-xl">참여 신청 관리</h2>
                {loadingApps && <p className="text-xs text-steel-300">불러오는 중...</p>}
                {!loadingApps && applications.length === 0 && (
                  <p className="text-xs text-steel-300">아직 신청자가 없습니다.</p>
                )}
                <div className="space-y-3">
                  {applications.map((app) => (
                    <div key={app.id} className={`dg-well p-4 border-l-[6px] ${app.status === "APPROVED" ? "border-l-plate-green" : app.status === "REJECTED" ? "border-l-plate-red" : "border-l-plate-yellow"}`}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold">{app.userNickname}</span>
                        <span className="text-xs text-steel-400">{formatDate(app.createdAt)}</span>
                      </div>
                      <p className="text-xs text-steel-400 mt-1">상태: {app.status}</p>
                      <div className="flex gap-2 mt-3 text-xs">
                        <button
                          type="button"
                          className="dg-btn dg-chalk-burst min-h-[34px] bg-plate-green px-3 text-xs text-white"
                          onClick={() => updateStatus(app.id, "APPROVED")}
                        >
                          승인
                        </button>
                        <button
                          type="button"
                          className="dg-btn dg-btn-steel min-h-[34px] px-3 text-xs"
                          onClick={() => updateStatus(app.id, "REJECTED")}
                        >
                          거절
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="dg-steel p-6 space-y-3">
              <h2 className="font-display text-xl">작성자 신뢰 지표</h2>
              <div className="flex items-center justify-between text-sm text-steel-300">
                <span>완료 공구 수</span>
                <span className="font-num text-lg font-black text-white"><CountNumber value={Math.max(1, Math.round(rating * 3))} />회</span>
              </div>
              <div className="flex items-center justify-between text-sm text-steel-300">
                <span>평균 평점</span>
                <span className="font-num text-lg font-black text-white">{rating.toFixed(1)} / 5</span>
              </div>
              <div className="dg-well p-4 text-xs text-steel-300">
                이 작성자는 지역 기반 나눔을 꾸준히 완료한 사용자입니다.
              </div>
            </div>

            <div className="dg-steel p-6 space-y-3">
              <h2 className="font-display text-xl">모집글 안내</h2>
              <p className="text-sm text-steel-300">승인 후 입장 가능</p>
              <div className="dg-well p-4 text-xs text-steel-300">
                <p>최근 공지: 분배 일정은 승인 이후 일괄 공유됩니다.</p>
              </div>
              <Link
                to="/protein"
                className="dg-btn dg-btn-steel w-full text-sm"
              >
                모집글 목록으로
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
