import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { displayEmail } from "../lib/displayEmail";
import { friendlyError, httpError } from "../lib/httpError";
import { toast } from "../lib/toast";
import {
  GYM_JOIN_POLICY_LABEL,
  GYM_ROLE_LABEL,
  GYM_STATUS_CHIP,
  GYM_STATUS_LABEL,
  GYM_TYPE_CHIP,
  GYM_TYPE_LABEL,
  GYM_VISIBILITY_LABEL,
} from "../types/gym";
import type { GymJoinPolicy, GymJoinRequest, GymJoinResult, GymMember, GymSummary, GymVisibility } from "../types/gym";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

// 모임 한 곳의 페이지(/g/:slug). 로그인 없이도 공개 모임은 보인다.
// 비공개 · 승인 대기 모임은 멤버이거나 초대 링크(?code=)로 들어온 사람에게만 보인다.
// 가입 · 나가기 · 가입 신청은 크루 API 를 모임의 숫자 id 로 그대로 쓴다.

const readLoggedIn = () => {
  try {
    return Boolean(localStorage.getItem("user"));
  } catch {
    return false;
  }
};

const INPUT =
  "w-full min-w-0 rounded-md border-2 border-black bg-steel-900 px-3 py-2 text-base text-chalk placeholder:text-steel-500 focus:outline-none focus-visible:border-plate-yellow";

const ROLE_CHIP: Record<GymMember["role"], string> = {
  OWNER: "bg-plate-red text-white",
  STAFF: "bg-plate-blue text-white",
  MEMBER: "bg-steel-700 text-steel-300",
};

// 득근득근 동아리 본 모임에만 붙는 기존 동아리 화면들
const CLUB_LINKS = [
  { to: "/about", label: "동아리 소개" },
  { to: "/executives", label: "운영진" },
  { to: "/members", label: "회원 명단" },
  { to: "/gallery", label: "갤러리" },
];

function Loading() {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-sm text-steel-400" role="status">
      <span className="dg-loading-plates" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span>불러오는 중</span>
    </div>
  );
}

function MemberRow({ m, children }: { m: GymMember; children?: ReactNode }) {
  return (
    <li className="dg-well flex flex-wrap items-center gap-2 p-3">
      <span className={`dg-chip text-xs ${ROLE_CHIP[m.role]}`}>{GYM_ROLE_LABEL[m.role]}</span>
      <span className="min-w-0 flex-1 truncate font-bold">{m.nickname}</span>
      {m.title && <span className="max-w-[40%] truncate text-xs text-steel-300">{m.title}</span>}
      {children}
    </li>
  );
}

export default function GymPage() {
  const { slug = "" } = useParams();
  const [searchParams] = useSearchParams();
  const code = (searchParams.get("code") ?? "").trim();
  const [loggedIn] = useState(readLoggedIn);

  const [gym, setGym] = useState<GymSummary | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<GymMember[]>([]);
  const [members, setMembers] = useState<GymMember[] | null>(null);
  const [requests, setRequests] = useState<GymJoinRequest[] | null>(null);
  const [busy, setBusy] = useState(false);

  // 설정(모임장)
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editVisibility, setEditVisibility] = useState<GymVisibility>("PUBLIC");
  const [editJoinPolicy, setEditJoinPolicy] = useState<GymJoinPolicy>("AUTO_APPROVE");
  const [saving, setSaving] = useState(false);

  const codeQuery = code ? `?code=${encodeURIComponent(code)}` : "";
  const base = `${API_BASE}/api/gyms/${encodeURIComponent(slug)}`;

  const load = useCallback(async () => {
    try {
      setError(null);
      setNotFound(false);
      const res = await fetch(`${base}${codeQuery}`, { credentials: "include" });
      if (res.status === 404) {
        setNotFound(true);
        setGym(null);
        return;
      }
      if (!res.ok) throw await httpError(res, "모임을 불러오지 못했어요.");
      const data = (await res.json()) as GymSummary;
      setGym(data);
      setEditName(data.name);
      setEditDescription(data.description ?? "");
      setEditVisibility(data.visibility);
      setEditJoinPolicy(data.joinPolicy);

      const staffQuery = code ? `?role=STAFF&code=${encodeURIComponent(code)}` : "?role=STAFF";
      const staffRes = await fetch(`${base}/members${staffQuery}`, { credentials: "include" });
      setStaff(staffRes.ok ? ((await staffRes.json()) as GymMember[]) : []);

      if (data.joined) {
        const mRes = await fetch(`${base}/members`, { credentials: "include" });
        setMembers(mRes.ok ? ((await mRes.json()) as GymMember[]) : []);
      } else {
        setMembers(null);
      }

      if (data.myRole === "OWNER" || data.myRole === "STAFF") {
        const rRes = await fetch(`${API_BASE}/api/crew/groups/${data.id}/join-requests`, { credentials: "include" });
        setRequests(rRes.ok ? ((await rRes.json()) as GymJoinRequest[]) : []);
      } else {
        setRequests(null);
      }
    } catch (e) {
      setError(friendlyError(e, "모임을 불러오지 못했어요."));
    }
  }, [base, code, codeQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (url: string, method: string, fallback: string, body?: unknown) => {
    const res = await fetch(url, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw await httpError(res, fallback);
    return res;
  };

  const join = async (byCode: boolean) => {
    if (!gym) return;
    try {
      setBusy(true);
      const url = byCode
        ? `${API_BASE}/api/crew/groups/join-by-code/${encodeURIComponent(code)}`
        : `${API_BASE}/api/crew/groups/${gym.id}/join`;
      const res = await post(url, "POST", "가입하지 못했어요.");
      let result: GymJoinResult | null = null;
      try {
        result = (await res.json()) as GymJoinResult;
      } catch {
        result = null;
      }
      const ok = result?.result === "JOINED" || result?.result === "ALREADY_MEMBER";
      const msg =
        result?.message && /[가-힣]/.test(result.message)
          ? result.message
          : result?.result === "PENDING" // 서버는 승인 대기 신청을 PENDING 으로 돌려준다(CrewServiceImpl.joinWithPolicy)
          ? "가입 신청을 보냈어요. 모임장이 승인하면 가입돼요."
          : "가입했어요.";
      toast(msg, ok || result?.result === "PENDING" ? "success" : "info");
      await load();
    } catch (e) {
      toast(friendlyError(e, "가입하지 못했어요."), "error");
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (!gym) return;
    if (!window.confirm(`"${gym.name}" 모임에서 나갈까요?`)) return;
    try {
      setBusy(true);
      await post(`${API_BASE}/api/crew/groups/${gym.id}/leave`, "DELETE", "모임에서 나가지 못했어요.");
      toast("모임에서 나왔어요.", "success");
      await load();
    } catch (e) {
      toast(friendlyError(e, "모임에서 나가지 못했어요."), "error");
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (m: GymMember, role: "STAFF" | "MEMBER") => {
    try {
      setBusy(true);
      await post(`${base}/members/${m.userId}`, "PATCH", "역할을 바꾸지 못했어요.", { role });
      toast(`${m.nickname} 님을 ${GYM_ROLE_LABEL[role]}(으)로 바꿨어요.`, "success");
      await load();
    } catch (e) {
      toast(friendlyError(e, "역할을 바꾸지 못했어요."), "error");
    } finally {
      setBusy(false);
    }
  };

  const decide = async (r: GymJoinRequest, action: "approve" | "reject") => {
    if (!gym) return;
    try {
      setBusy(true);
      await post(
        `${API_BASE}/api/crew/groups/${gym.id}/join-requests/${r.id}/${action}`,
        "POST",
        action === "approve" ? "승인하지 못했어요." : "거절하지 못했어요.",
      );
      toast(action === "approve" ? `${r.nickname} 님의 가입을 승인했어요.` : `${r.nickname} 님의 신청을 거절했어요.`, "success");
      await load();
    } catch (e) {
      toast(friendlyError(e, action === "approve" ? "승인하지 못했어요." : "거절하지 못했어요."), "error");
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      toast("모임 이름을 적어 주세요.", "error");
      return;
    }
    try {
      setSaving(true);
      await post(base, "PATCH", "설정을 저장하지 못했어요.", {
        name: editName.trim(),
        description: editDescription.trim(),
        visibility: editVisibility,
        joinPolicy: editJoinPolicy,
      });
      toast("설정을 저장했어요.", "success");
      await load();
    } catch (err) {
      toast(friendlyError(err, "설정을 저장하지 못했어요."), "error");
    } finally {
      setSaving(false);
    }
  };

  const inviteLink = gym?.inviteCode ? `${window.location.origin}/g/${gym.slug}?code=${gym.inviteCode}` : "";

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast("초대 링크를 복사했어요.", "success");
    } catch {
      toast("복사하지 못했어요. 링크를 길게 눌러 직접 복사해 주세요.", "error");
    }
  };

  const loginNext = `/g/${slug}${codeQuery}`;

  return (
    <section className="relative min-h-screen overflow-x-hidden pb-24 pt-24 text-white">
      <div className="mx-auto max-w-4xl space-y-5 px-4 sm:px-6">
        {notFound && (
          <div className="dg-steel space-y-3 p-6">
            <h1 className="font-display text-2xl">모임을 찾을 수 없어요</h1>
            <p className="break-keep text-sm text-steel-300">
              찾을 수 없는 모임이에요(비공개이거나 없어진 모임). 초대 링크를 받았다면 링크를 그대로 열어 주세요.
            </p>
            <Link to="/gyms" className="dg-btn dg-btn-primary min-h-[44px] text-sm">
              모임 찾기로 가기
            </Link>
          </div>
        )}

        {error && (
          <div className="dg-steel flex flex-wrap items-center gap-3 p-5 text-sm text-steel-300">
            <span>{error}</span>
            <button type="button" className="dg-btn dg-btn-steel" onClick={() => void load()}>
              다시 시도
            </button>
          </div>
        )}

        {!notFound && !error && !gym && <Loading />}

        {gym && (
          <>
            <header className="dg-steel p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`dg-chip text-xs ${GYM_TYPE_CHIP[gym.type]}`}>{GYM_TYPE_LABEL[gym.type]}</span>
                {gym.status !== "ACTIVE" && (
                  <span className={`dg-chip text-xs ${GYM_STATUS_CHIP[gym.status]}`}>
                    {gym.status === "PENDING" ? "승인 대기 — 아직 찾기에는 안 보여요" : GYM_STATUS_LABEL[gym.status]}
                  </span>
                )}
                {gym.visibility !== "PUBLIC" && (
                  <span className="dg-chip bg-steel-700 text-xs text-steel-300">{GYM_VISIBILITY_LABEL[gym.visibility]}</span>
                )}
                {gym.myRole && (
                  <span className={`dg-chip text-xs ${ROLE_CHIP[gym.myRole]}`}>내 역할 · {GYM_ROLE_LABEL[gym.myRole]}</span>
                )}
              </div>
              <h1 className="mt-2 break-keep text-3xl [overflow-wrap:anywhere] sm:text-4xl">{gym.name}</h1>
              <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-steel-400">
                {gym.schoolDomain && <span className="break-all">{gym.schoolDomain}</span>}
                {gym.region && <span className="break-keep">{gym.region}</span>}
                <span>
                  멤버 <span className="font-num font-bold text-chalk">{gym.memberCount}</span>명
                </span>
                <span>{GYM_JOIN_POLICY_LABEL[gym.joinPolicy]}</span>
              </p>
              {gym.description && (
                <p className="mt-3 whitespace-pre-line break-keep text-sm text-steel-200 [overflow-wrap:anywhere]">
                  {gym.description}
                </p>
              )}

              {/* 가입 / 나가기 */}
              <div className="mt-4 flex flex-wrap gap-2">
                {!gym.joined && !loggedIn && (
                  <Link
                    to={`/login?next=${encodeURIComponent(loginNext)}`}
                    state={{ from: loginNext }}
                    className="dg-btn dg-btn-primary min-h-[44px] text-sm"
                  >
                    로그인하고 가입하기
                  </Link>
                )}
                {!gym.joined && loggedIn && code && (
                  <button type="button" className="dg-btn dg-btn-primary min-h-[44px] text-sm" disabled={busy} onClick={() => void join(true)}>
                    초대 코드로 가입
                  </button>
                )}
                {!gym.joined && loggedIn && !code && gym.status === "ACTIVE" && gym.visibility !== "PRIVATE" && (
                  <button type="button" className="dg-btn dg-btn-primary min-h-[44px] text-sm" disabled={busy} onClick={() => void join(false)}>
                    {gym.joinPolicy === "LEADER_APPROVE" ? "가입 신청" : "가입하기"}
                  </button>
                )}
                {gym.joined && gym.myRole !== "OWNER" && (
                  <button type="button" className="dg-btn dg-btn-steel min-h-[44px] text-sm" disabled={busy} onClick={() => void leave()}>
                    모임 나가기
                  </button>
                )}
              </div>
            </header>

            {gym.type === "CLUB" && gym.slug === "ajou-muscleup" && (
              <nav className="dg-steel p-4" aria-label="동아리 화면">
                <h2 className="font-display text-lg">동아리 둘러보기</h2>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CLUB_LINKS.map((l) => (
                    <Link key={l.to} to={l.to} className="dg-btn dg-btn-steel min-h-[44px] text-sm">
                      {l.label}
                    </Link>
                  ))}
                </div>
              </nav>
            )}

            {gym.joined && inviteLink && (
              <div className="dg-steel p-4">
                <h2 className="font-display text-lg">초대 링크</h2>
                <p className="mt-1 break-keep text-xs text-steel-400">이 링크를 받은 사람은 바로 모임을 보고 가입할 수 있어요.</p>
                <div className="mt-3 flex gap-2">
                  <input readOnly value={inviteLink} aria-label="초대 링크" onFocus={(e) => e.currentTarget.select()} className={`${INPUT} font-num text-sm`} />
                  <button type="button" className="dg-btn dg-btn-primary shrink-0 min-h-[44px] px-4 text-sm" onClick={() => void copyInvite()}>
                    복사
                  </button>
                </div>
              </div>
            )}

            {staff.length > 0 && (
              <div className="dg-steel p-4">
                <h2 className="font-display text-lg">모임장 · 운영진</h2>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {staff.map((m) => (
                    <MemberRow key={m.userId} m={m} />
                  ))}
                </ul>
              </div>
            )}

            {(gym.myRole === "OWNER" || gym.myRole === "STAFF") && requests && (
              <div className="dg-steel border-t-[8px] border-t-plate-yellow p-4">
                <h2 className="font-display text-lg">가입 신청</h2>
                {requests.filter((r) => r.status === "PENDING").length === 0 ? (
                  <p className="mt-2 text-sm text-steel-400">기다리는 신청이 없어요.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {requests
                      .filter((r) => r.status === "PENDING")
                      .map((r) => {
                        const email = displayEmail(r.email);
                        return (
                          <li key={r.id} className="dg-well flex flex-wrap items-center gap-2 p-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-bold">{r.nickname}</p>
                              {email && <p className="truncate text-xs text-steel-400">{email}</p>}
                            </div>
                            <button type="button" className="dg-btn dg-btn-primary min-h-[40px] px-3 text-sm" disabled={busy} onClick={() => void decide(r, "approve")}>
                              승인
                            </button>
                            <button type="button" className="dg-btn dg-btn-steel min-h-[40px] px-3 text-sm" disabled={busy} onClick={() => void decide(r, "reject")}>
                              거절
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                )}
              </div>
            )}

            {gym.joined && members && (
              <div className="dg-steel p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-display text-lg">멤버</h2>
                  <span className="font-num text-sm text-steel-400">{members.length}명</span>
                </div>
                {members.length === 0 ? (
                  <p className="mt-2 text-sm text-steel-400">멤버 목록을 불러오지 못했어요.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {members.map((m) => (
                      <MemberRow key={m.userId} m={m}>
                        {gym.myRole === "OWNER" && m.role !== "OWNER" && (
                          <button
                            type="button"
                            className="dg-btn dg-btn-steel min-h-[36px] px-3 text-xs"
                            disabled={busy}
                            onClick={() => void changeRole(m, m.role === "STAFF" ? "MEMBER" : "STAFF")}
                          >
                            {m.role === "STAFF" ? "멤버로" : "운영진으로"}
                          </button>
                        )}
                      </MemberRow>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {gym.myRole === "OWNER" && (
              <form onSubmit={saveSettings} className="dg-steel space-y-3 p-4">
                <h2 className="font-display text-lg">모임 설정</h2>
                <label className="block space-y-1">
                  <span className="text-sm font-bold">모임 이름</span>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={60} className={INPUT} required />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-bold">소개</span>
                  <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} maxLength={500} className={INPUT} />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block min-w-0 space-y-1">
                    <span className="text-sm font-bold">공개 범위</span>
                    <select value={editVisibility} onChange={(e) => setEditVisibility(e.target.value as GymVisibility)} className={INPUT}>
                      {(Object.keys(GYM_VISIBILITY_LABEL) as GymVisibility[]).map((v) => (
                        <option key={v} value={v}>
                          {GYM_VISIBILITY_LABEL[v]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block min-w-0 space-y-1">
                    <span className="text-sm font-bold">가입 방식</span>
                    <select value={editJoinPolicy} onChange={(e) => setEditJoinPolicy(e.target.value as GymJoinPolicy)} className={INPUT}>
                      {(Object.keys(GYM_JOIN_POLICY_LABEL) as GymJoinPolicy[]).map((p) => (
                        <option key={p} value={p}>
                          {GYM_JOIN_POLICY_LABEL[p]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button type="submit" className="dg-btn dg-btn-primary min-h-[44px] w-full text-sm sm:w-auto sm:px-6" disabled={saving}>
                  {saving ? "저장 중…" : "설정 저장"}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </section>
  );
}
