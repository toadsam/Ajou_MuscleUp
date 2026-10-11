import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useCountUp } from "../hooks/useCountUp";
import ReportDialog from "../components/ReportDialog";
import { toast } from "../lib/toast";
import { HttpError, friendlyError, httpError } from "../lib/httpError";
import { deadlineLabel, distributionOf, findMetaLine, isClosed, remainingLabel } from "../utils/proteinMeta";

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
  imageUrl?: string; // 공개용 대표 이미지
  receiptUrl?: string | null; // 서버가 볼 수 있는 사람(작성자 · 관리자 · 승인된 참여자)에게만 채운다
  description?: string;
  category?: string;
  avgRating?: number | null;
  reviewCount?: number;
  ownerNickname?: string | null;
  mine?: boolean; // 내가 작성자인지(서버 계산, 이메일은 내려오지 않는다)
  deadline?: string | null;
  daysLeft?: number | null;
  closed?: boolean;
  distributionMethod?: string | null;
  gymSlug?: string | null; // 연 모임(없으면 null)
  gymName?: string | null;
  visibility?: "GYM" | "PUBLIC" | null; // GYM 우리 모임만 · PUBLIC 전체 모집
  region?: string | null;
  maxParticipants?: number | null;
  // 전체 모집에서 여는 사람 신뢰 표시(가입 후 지난 날 · 누적 운동 일수). 모르면 null
  ownerMemberDays?: number | null;
  ownerWorkoutDays?: number | null;
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

// 단계는 실제로 알 수 있는 것만: 마감일 전/후. (예전 "분배완료"는 후기 유무로 짐작한 값이었다)
const statusSteps = ["모집 중", "모집 마감"] as const;

const APPLICATION_LABEL: Record<ApplicationStatus, string> = {
  PENDING: "승인 대기",
  APPROVED: "승인 완료",
  REJECTED: "거절",
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
    toast("로그인이 필요해요.", "error");
    window.location.href = "/login";
    throw await httpError(res, "로그인이 필요해요.");
  }

  if (!res.ok) throw await httpError(res, "요청을 처리하지 못했어요.");

  return res.json();
}

export default function ProteinDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<Protein | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  // 404: 없는 글이거나 그 모임 멤버가 아니라 볼 수 없는 글(서버가 구분하지 않는다)
  const [notVisible, setNotVisible] = useState(false);
  const [summary, setSummary] = useState<Summary>({ pendingCount: 0, approvedCount: 0 });
  const [myApplication, setMyApplication] = useState<Application | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [loadingApps, setLoadingApps] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const userRaw = localStorage.getItem("user");
  const user = userRaw ? (JSON.parse(userRaw) as { email?: string; role?: string }) : null;
  const isAdmin = (user?.role || "").includes("ADMIN");

  const isOwner = !!data?.mine;

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
        if (!res.ok) throw await httpError(res, "모집글을 불러오지 못했어요.");
        const json: Protein = await res.json();
        setData(json);
      } catch (e) {
        if (e instanceof HttpError && e.status === 404) setNotVisible(true);
        setErr(friendlyError(e, "모집글을 불러오지 못했어요."));
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
    } catch (e) {
      toast(friendlyError(e, "참여 신청을 하지 못했어요."), "error");
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
    } catch (e) {
      toast(friendlyError(e, "신청 상태를 바꾸지 못했어요."), "error");
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
    } catch (e) {
      toast(friendlyError(e, "메시지를 보내지 못했어요."), "error");
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

  if (notVisible) {
    return (
      <section className="pt-28 px-6 lg:px-12 min-h-screen text-white">
        <div className="dg-steel dg-rise max-w-3xl mx-auto space-y-4 p-8">
          <h1 className="font-display text-2xl">볼 수 없는 공동구매예요.</h1>
          <p className="text-steel-300">그 모임 멤버만 볼 수 있어요. 글이 지워졌을 수도 있어요.</p>
          <Link to="/protein" className="dg-btn dg-btn-primary px-5">
            공동구매 목록으로
          </Link>
        </div>
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

  const hasReviews = (data.reviewCount ?? 0) > 0 && typeof data.avgRating === "number";
  const rating = data.avgRating ?? 0;
  const closed = isClosed(data);
  const status = closed ? "모집 마감" : "모집 중";
  const perPrice =
    typeof data.price === "number" && typeof data.goal === "number" && data.goal > 0
      ? Math.ceil(data.price / data.goal)
      : null;
  const target = data.goal ?? 0; // 목표 인원이 없으면 지어내지 않는다(예전 기본값 4)
  const approved = summary.approvedCount;
  const pending = summary.pendingCount;
  const { region, gym } = parseLocation(data.category);
  const distributionType = distributionOf(data) ?? "정보 없음";
  const distributionSpot =
    findMetaLine(data.description, "분배 위치") ||
    findMetaLine(data.description, "분배위치") ||
    "협의 중";
  // 작성자가 적은 값만 보여 준다(예전: 목표 인원으로 "N인분", 제품명 첫 낱말로 브랜드를 지어냈다)
  const totalCapacity = findMetaLine(data.description, "총 용량") || "미정";
  const perCapacity = findMetaLine(data.description, "1인 분배") || "미정";
  const brand = findMetaLine(data.description, "브랜드");
  const canSeeReceipt = isOwner || isAdmin || myApplication?.status === "APPROVED";
  const deadlineText = deadlineLabel(data);
  // 값이 없는 쪽은 빼고 보여 준다
  const trustParts = [
    typeof data.ownerMemberDays === "number" ? `가입 ${data.ownerMemberDays}일` : null,
    typeof data.ownerWorkoutDays === "number" ? `운동 ${data.ownerWorkoutDays}일` : null,
  ].filter((part): part is string => part !== null);

  return (
    <section className="pt-24 pb-16 px-6 lg:px-12 min-h-screen text-white">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="dg-chip bg-plate-green text-sm text-white">{region}</span>
          <span className="dg-chip bg-plate-yellow text-sm text-black">{gym}</span>
          {data.visibility === "PUBLIC" ? (
            <span className="dg-chip bg-plate-yellow text-sm text-black">전체 모집</span>
          ) : data.visibility === "GYM" ? (
            <span className="dg-chip max-w-full bg-plate-blue text-sm text-white">
              <span className="flex-none">우리 모임</span>
              {data.gymName && <span className="min-w-0 max-w-[12rem] truncate font-sans font-bold">· {data.gymName}</span>}
            </span>
          ) : null}
          {data.region && <span className="max-w-[14rem] truncate text-sm text-steel-300">{data.region}</span>}
          {typeof data.maxParticipants === "number" && (
            <span className="text-sm font-semibold text-steel-200">
              최대 <span className="font-num font-black">{data.maxParticipants}</span>명
            </span>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-6">
            <div className="dg-steel p-6 space-y-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  {brand && <p className="text-sm font-semibold text-steel-400">{brand}</p>}
                  <h1 className="text-3xl md:text-4xl">{data.name}</h1>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-steel-400">
                    <span>작성자: {data.ownerNickname || "익명"}</span>
                    {user && !isOwner && (
                      <button
                        type="button"
                        onClick={() => setReportOpen(true)}
                        className="font-semibold text-steel-400 underline-offset-2 hover:text-red-300 hover:underline"
                      >
                        신고
                      </button>
                    )}
                  </p>
                </div>
                <div className="text-right text-sm text-steel-300">
                  <p>
                    상태:{" "}
                    <span className={`dg-chip text-sm ${closed ? "bg-steel-700 text-steel-200" : "bg-plate-yellow text-black"}`}>
                      {status}
                    </span>
                  </p>
                  <p>
                    {remainingLabel(data)}
                    {deadlineText && <span className="text-steel-400"> · {deadlineText} 마감</span>}
                  </p>
                </div>
              </div>

              <div className="flex gap-1.5">
                {statusSteps.map((step, idx) => {
                  const isActive = statusSteps.indexOf(step) <= statusSteps.indexOf(status);
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
                  {data.receiptUrl ? (
                    <img src={data.receiptUrl} alt="영수증 사진" className="mt-2 h-32 w-full object-cover rounded border-2 border-black" />
                  ) : canSeeReceipt ? (
                    <p className="text-sm mt-2">등록된 인증 이미지가 없습니다.</p>
                  ) : (
                    <p className="text-sm mt-2 text-steel-300">작성자, 운영진, 승인된 참여자에게만 보여요.</p>
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
              <h2 className="font-display text-xl mb-4">공동구매 후기 요약</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="dg-well p-4">
                  <p className="text-xs text-steel-400">평균 만족도</p>
                  {hasReviews ? (
                    <p className="font-num text-4xl font-black text-green-300"><CountNumber value={rating} digits={1} /> <span className="text-lg text-steel-400">/ 5</span></p>
                  ) : (
                    <p className="mt-2 text-sm text-steel-300">아직 후기가 없어요.</p>
                  )}
                </div>
                <div className="dg-well p-4">
                  <p className="text-xs text-steel-400">후기 수</p>
                  <p className="font-num text-4xl font-black text-white">{data.reviewCount ?? 0}<span className="ml-1 text-lg text-steel-400">개</span></p>
                </div>
              </div>
              <Link to={`/reviews?proteinId=${data.id}`} className="dg-btn dg-btn-steel mt-4 px-4 text-sm">
                후기 보기
              </Link>
            </div>

            <div className="dg-steel p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl">공동구매 소통 공간</h2>
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
                  {target > 0 ? (
                    <>
                      목표 <span className="font-num text-lg font-black">{target}</span>명 중{" "}
                    </>
                  ) : (
                    "목표 인원 미정 · "
                  )}
                  <span key={approved} className="dg-pop font-num inline-block text-lg font-black text-plate-green">{approved}</span>명 승인
                </p>
                {target <= 0 ? null : target <= 12 ? (
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
                <p className="text-xs text-steel-400 mt-2">
                  대기 인원 {pending}명
                  {typeof data.maxParticipants === "number" && ` · 최대 ${data.maxParticipants}명`}
                </p>
              </div>
              {data.visibility === "PUBLIC" && (
                // 전체 모집은 모르는 사람과의 거래라, 여는 사람의 기록을 먼저 보여 준다
                <div className="dg-well border-l-[6px] border-l-plate-yellow p-4 text-sm text-steel-200">
                  <p className="text-xs font-bold text-steel-400">여는 사람 기록</p>
                  {trustParts.length > 0 && <p className="mt-1 font-semibold text-white">{trustParts.join(" · ")}</p>}
                  <p className="mt-2 text-xs text-steel-300">앱은 결제를 중개하지 않아요. 송금 전에 여는 사람의 기록을 확인하세요.</p>
                </div>
              )}
              {(isOwner || isAdmin) ? (
                <div className="dg-well p-4 text-xs text-steel-300">
                  {isOwner ? "작성자 계정입니다." : "관리자 계정입니다."}
                </div>
              ) : myApplication ? (
                <div key={myApplication.status} className="dg-pop dg-well border-l-[6px] border-l-plate-yellow p-4 text-xs text-steel-200">
                  신청 상태: {APPLICATION_LABEL[myApplication.status] ?? myApplication.status}
                </div>
              ) : closed ? (
                <div className="dg-well p-4 text-xs text-steel-300">모집이 마감되어 새로 신청할 수 없어요.</div>
              ) : (
                <button
                  className="dg-btn dg-btn-primary w-full"
                  onClick={handleApply}
                >
                  참여하기 (신청)
                </button>
              )}
              <div className="dg-well p-4 text-xs text-steel-300">
                승인된 사용자만 공동구매 전용 소통 공간에 접근할 수 있습니다.
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
                      <p className="text-xs text-steel-400 mt-1">상태: {APPLICATION_LABEL[app.status] ?? app.status}</p>
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
              <h2 className="font-display text-xl">모집글 안내</h2>
              <p className="text-sm text-steel-300">승인 후 입장 가능</p>
              <div className="dg-well p-4 text-xs text-steel-300">
                <p>분배 일정은 승인된 참여자에게 소통 공간에서 공유돼요.</p>
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

      <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} targetType="PROTEIN" targetId={data.id} subjectLabel="이 공동구매" />
    </section>
  );
}
