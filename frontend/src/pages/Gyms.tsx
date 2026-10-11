import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { friendlyError, httpError } from "../lib/httpError";
import { toast } from "../lib/toast";
import {
  GYM_JOIN_POLICY_LABEL,
  GYM_SLUG_PATTERN,
  GYM_STATUS_CHIP,
  GYM_STATUS_LABEL,
  GYM_TYPE_CHIP,
  GYM_TYPE_LABEL,
  GYM_TYPES,
  GYM_VISIBILITY_LABEL,
} from "../types/gym";
import type { GymJoinPolicy, GymSummary, GymType, GymVisibility } from "../types/gym";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

// 모임 찾기: 동아리 · 운동 모임 · 헬스장 · PT 를 한곳에서 찾고 만든다.
// 목록은 로그인 없이 보이고, 내 모임 · 만들기는 로그인한 사람에게만 보인다.

const readLoggedIn = () => {
  try {
    return Boolean(localStorage.getItem("user"));
  } catch {
    return false;
  }
};

const readIsAdmin = () => {
  try {
    const raw = localStorage.getItem("user");
    const role = raw ? String((JSON.parse(raw) as { role?: string }).role ?? "") : "";
    return role.toUpperCase().includes("ADMIN");
  } catch {
    return false;
  }
};

const INPUT =
  "w-full min-w-0 rounded-md border-2 border-black bg-steel-900 px-3 py-2 text-base text-chalk placeholder:text-steel-500 focus:outline-none focus-visible:border-plate-yellow";

function Loading() {
  return (
    <p className="flex items-center gap-3 text-sm text-steel-400" role="status">
      <span className="dg-loading-plates" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      불러오는 중
    </p>
  );
}

function GymCard({ gym, showStatus }: { gym: GymSummary; showStatus?: boolean }) {
  const place = [gym.schoolDomain, gym.region].filter(Boolean).join(" · ");
  return (
    <Link
      to={`/g/${gym.slug}`}
      className={`dg-well dg-lift block min-w-0 p-4 ${gym.joined ? "border-l-[6px] border-l-plate-green" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`dg-chip text-xs ${GYM_TYPE_CHIP[gym.type]}`}>{GYM_TYPE_LABEL[gym.type]}</span>
        {showStatus && gym.status !== "ACTIVE" && (
          <span className={`dg-chip text-xs ${GYM_STATUS_CHIP[gym.status]}`}>{GYM_STATUS_LABEL[gym.status]}</span>
        )}
        {gym.joined && <span className="dg-chip bg-plate-green text-xs text-white">가입함</span>}
        <span className="font-num ml-auto text-sm font-bold text-steel-300">{gym.memberCount}명</span>
      </div>
      <h3 className="mt-2 truncate font-bold text-chalk">{gym.name}</h3>
      {place && <p className="mt-0.5 truncate text-xs text-steel-400">{place}</p>}
      {gym.description && <p className="mt-2 line-clamp-2 break-keep text-sm text-steel-300">{gym.description}</p>}
    </Link>
  );
}

export default function Gyms() {
  const navigate = useNavigate();
  const [loggedIn] = useState(readLoggedIn);
  const [isAdmin] = useState(readIsAdmin);

  // 내 모임
  const [mine, setMine] = useState<GymSummary[] | null>(null);
  const [mineError, setMineError] = useState<string | null>(null);

  // 찾기
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<GymType | "">("");
  const [results, setResults] = useState<GymSummary[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  // 만들기
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [type, setType] = useState<GymType>("CREW");
  const [visibility, setVisibility] = useState<GymVisibility>("PUBLIC");
  const [joinPolicy, setJoinPolicy] = useState<GymJoinPolicy>("AUTO_APPROVE");
  const [schoolDomain, setSchoolDomain] = useState("");
  const [region, setRegion] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // 승인 대기(운영자)
  const [pending, setPending] = useState<GymSummary[] | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const loadMine = useCallback(async () => {
    if (!loggedIn) return;
    try {
      setMineError(null);
      const res = await fetch(`${API_BASE}/api/gyms/mine`, { credentials: "include" });
      if (!res.ok) throw await httpError(res, "내 모임을 불러오지 못했어요.");
      setMine((await res.json()) as GymSummary[]);
    } catch (e) {
      setMineError(friendlyError(e, "내 모임을 불러오지 못했어요."));
    }
  }, [loggedIn]);

  const search = useCallback(async (query: string, t: GymType | "") => {
    try {
      setSearching(true);
      setSearchError(null);
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (t) params.set("type", t);
      const qs = params.toString();
      const res = await fetch(`${API_BASE}/api/gyms${qs ? `?${qs}` : ""}`, { credentials: "include" });
      if (!res.ok) throw await httpError(res, "모임을 찾지 못했어요.");
      setResults((await res.json()) as GymSummary[]);
    } catch (e) {
      setSearchError(friendlyError(e, "모임을 찾지 못했어요."));
    } finally {
      setSearching(false);
    }
  }, []);

  const loadPending = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/gyms?status=PENDING`, { credentials: "include" });
      if (!res.ok) throw await httpError(res, "승인 대기 목록을 불러오지 못했어요.");
      setPending((await res.json()) as GymSummary[]);
    } catch (e) {
      toast(friendlyError(e, "승인 대기 목록을 불러오지 못했어요."), "error");
      setPending([]);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadMine();
    void loadPending();
  }, [loadMine, loadPending]);

  // 종류를 바꾸면 바로 다시 찾는다(검색어는 버튼/엔터로)
  useEffect(() => {
    void search(q, typeFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, search]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    void search(q, typeFilter);
  };

  const slugValid = GYM_SLUG_PATTERN.test(slug);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast("모임 이름을 적어 주세요.", "error");
      return;
    }
    if (!slugValid) {
      toast("주소는 영어 소문자 · 숫자 · 하이픈(-)으로 3~40자로 적어 주세요.", "error");
      return;
    }
    try {
      setCreating(true);
      const res = await fetch(`${API_BASE}/api/gyms`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug,
          type,
          visibility,
          joinPolicy,
          description: description.trim() || undefined,
          schoolDomain: schoolDomain.trim().toLowerCase() || undefined,
          region: region.trim() || undefined,
        }),
      });
      if (!res.ok) {
        if (res.status === 409) throw new Error("이미 쓰고 있는 주소예요. 다른 주소를 적어 주세요.");
        throw await httpError(res, "모임을 만들지 못했어요.");
      }
      const created = (await res.json()) as GymSummary;
      if (created.status === "PENDING") {
        toast("운영자 승인 후 찾기에 보여요. 그동안에도 초대 링크로 멤버를 모을 수 있어요.", "success", 4500);
      } else {
        toast("모임을 만들었어요.", "success");
      }
      navigate(`/g/${created.slug}`);
    } catch (err) {
      toast(friendlyError(err, "모임을 만들지 못했어요."), "error");
    } finally {
      setCreating(false);
    }
  };

  const approve = async (gym: GymSummary) => {
    try {
      setApprovingId(gym.id);
      const res = await fetch(`${API_BASE}/api/admin/gyms/${gym.id}/approve`, { method: "POST", credentials: "include" });
      if (!res.ok) throw await httpError(res, "승인하지 못했어요.");
      toast(`"${gym.name}" 모임을 승인했어요.`, "success");
      await Promise.all([loadPending(), search(q, typeFilter)]);
    } catch (e) {
      toast(friendlyError(e, "승인하지 못했어요."), "error");
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <section className="relative min-h-screen overflow-x-hidden pb-24 pt-24 text-white">
      <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6 lg:px-10">
        <header className="dg-steel p-5 sm:p-6">
          <p className="text-sm font-bold text-plate-yellow">모임</p>
          <h1 className="mt-1 text-3xl sm:text-4xl">모임 찾기</h1>
          <p className="mt-2 break-keep text-sm text-steel-300">
            동아리 · 운동 모임 · 헬스장 · PT 를 찾아 가입하거나, 우리 모임을 직접 만들어 보세요.
          </p>
        </header>

        {isAdmin && pending && pending.length > 0 && (
          <div className="dg-steel border-t-[8px] border-t-plate-yellow p-4 sm:p-5">
            <h2 className="font-display text-lg">승인 대기</h2>
            <ul className="mt-3 space-y-2">
              {pending.map((gym) => (
                <li key={gym.id} className="dg-well flex flex-wrap items-center gap-3 p-3">
                  <span className={`dg-chip text-xs ${GYM_TYPE_CHIP[gym.type]}`}>{GYM_TYPE_LABEL[gym.type]}</span>
                  <Link to={`/g/${gym.slug}`} className="min-w-0 flex-1 truncate font-bold underline-offset-2 hover:underline">
                    {gym.name}
                    <span className="ml-2 text-xs font-normal text-steel-400">/g/{gym.slug}</span>
                  </Link>
                  <button
                    type="button"
                    className="dg-btn dg-btn-primary min-h-[40px] px-4 text-sm"
                    disabled={approvingId === gym.id}
                    onClick={() => void approve(gym)}
                  >
                    {approvingId === gym.id ? "승인 중…" : "승인"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {loggedIn && (
          <div className="dg-steel p-4 sm:p-5">
            <h2 className="font-display text-lg">내 모임</h2>
            <div className="mt-3">
              {mineError && <p className="text-sm text-red-200">{mineError}</p>}
              {!mineError && mine === null && <Loading />}
              {mine && mine.length === 0 && (
                <p className="break-keep text-sm text-steel-400">아직 가입한 모임이 없어요. 아래에서 찾아보거나 새로 만들어 보세요.</p>
              )}
              {mine && mine.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {mine.map((gym) => (
                    <GymCard key={gym.id} gym={gym} showStatus />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="dg-steel min-w-0 p-4 sm:p-5">
            <h2 className="font-display text-lg">찾기</h2>
            <form onSubmit={onSearch} className="mt-3 flex gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                maxLength={60}
                placeholder="모임 이름으로 찾기"
                aria-label="모임 이름으로 찾기"
                className={INPUT}
              />
              <button type="submit" className="dg-btn dg-btn-steel shrink-0 min-h-[44px] px-4 text-sm" disabled={searching}>
                찾기
              </button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="종류">
              {(["", ...GYM_TYPES] as (GymType | "")[]).map((t) => {
                const active = typeFilter === t;
                return (
                  <button
                    key={t || "ALL"}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setTypeFilter(t)}
                    className={`dg-chip min-h-[36px] px-3 text-sm ${active ? "bg-plate-yellow text-black" : "bg-steel-800 text-steel-300"}`}
                  >
                    {t ? GYM_TYPE_LABEL[t] : "전체"}
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              {searchError && (
                <div className="flex flex-wrap items-center gap-3 text-sm text-steel-300">
                  <span>{searchError}</span>
                  <button type="button" className="dg-btn dg-btn-steel" onClick={() => void search(q, typeFilter)}>
                    다시 시도
                  </button>
                </div>
              )}
              {!searchError && (results === null || searching) && <Loading />}
              {!searchError && !searching && results && results.length === 0 && (
                <div className="dg-well p-4 text-sm text-steel-300">
                  <p className="break-keep">
                    {q.trim() || typeFilter ? "조건에 맞는 모임이 없어요." : "아직 공개된 모임이 없어요."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(q.trim() || typeFilter) && (
                      <button
                        type="button"
                        className="dg-btn dg-btn-steel text-sm"
                        onClick={() => {
                          setQ("");
                          if (typeFilter) setTypeFilter("");
                          else void search("", "");
                        }}
                      >
                        전체 보기
                      </button>
                    )}
                    {loggedIn ? (
                      <a href="#gym-create" className="dg-btn dg-btn-primary text-sm">
                        모임 만들기
                      </a>
                    ) : (
                      <Link to="/login?next=/gyms" className="dg-btn dg-btn-primary text-sm">
                        로그인하고 모임 만들기
                      </Link>
                    )}
                  </div>
                </div>
              )}
              {!searchError && !searching && results && results.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2">
                  {results.map((gym) => (
                    <GymCard key={gym.id} gym={gym} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <aside id="gym-create" className="min-w-0">
            {loggedIn ? (
              <form onSubmit={onCreate} className="dg-steel space-y-3 border-t-[8px] border-t-plate-red p-4">
                <h2 className="font-display text-lg">모임 만들기</h2>
                <label className="block space-y-1">
                  <span className="text-sm font-bold">모임 이름</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={INPUT} required />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-bold">주소</span>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                    maxLength={40}
                    placeholder="예: ajou-morning-run"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className={`${INPUT} font-num`}
                    aria-invalid={slug.length > 0 && !slugValid}
                    required
                  />
                  <span className="block break-all text-xs text-steel-400">
                    득근득근 주소: <span className="font-num text-chalk">/g/{slug || "…"}</span>
                  </span>
                  {slug.length > 0 && !slugValid && (
                    <span className="block break-keep text-xs text-red-200">
                      영어 소문자 · 숫자 · 하이픈(-)만, 3~40자, 하이픈으로 시작하거나 끝나지 않게 적어 주세요.
                    </span>
                  )}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block min-w-0 space-y-1">
                    <span className="text-sm font-bold">종류</span>
                    <select value={type} onChange={(e) => setType(e.target.value as GymType)} className={INPUT}>
                      {GYM_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {GYM_TYPE_LABEL[t]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block min-w-0 space-y-1">
                    <span className="text-sm font-bold">공개 범위</span>
                    <select
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value as GymVisibility)}
                      className={INPUT}
                    >
                      {(Object.keys(GYM_VISIBILITY_LABEL) as GymVisibility[]).map((v) => (
                        <option key={v} value={v}>
                          {GYM_VISIBILITY_LABEL[v]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <fieldset className="space-y-1">
                  <legend className="text-sm font-bold">가입 방식</legend>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(GYM_JOIN_POLICY_LABEL) as GymJoinPolicy[]).map((p) => (
                      <label
                        key={p}
                        className={`dg-chip min-h-[36px] cursor-pointer px-3 text-sm ${joinPolicy === p ? "bg-plate-yellow text-black" : "bg-steel-800 text-steel-300"}`}
                      >
                        <input
                          type="radio"
                          name="joinPolicy"
                          value={p}
                          checked={joinPolicy === p}
                          onChange={() => setJoinPolicy(p)}
                          className="sr-only"
                        />
                        {GYM_JOIN_POLICY_LABEL[p]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="block space-y-1">
                  <span className="text-sm font-bold">
                    학교 이메일 도메인 <span className="font-normal text-steel-400">(선택)</span>
                  </span>
                  <input
                    value={schoolDomain}
                    onChange={(e) => setSchoolDomain(e.target.value)}
                    maxLength={80}
                    placeholder="예: ajou.ac.kr"
                    autoCapitalize="none"
                    spellCheck={false}
                    className={INPUT}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-bold">
                    지역 <span className="font-normal text-steel-400">(선택)</span>
                  </span>
                  <input value={region} onChange={(e) => setRegion(e.target.value)} maxLength={60} placeholder="예: 수원 영통" className={INPUT} />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-bold">소개</span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="어떤 모임인지, 언제 어디서 운동하는지 적어 주세요."
                    className={INPUT}
                  />
                </label>
                <button type="submit" className="dg-btn dg-btn-primary min-h-[44px] w-full text-sm" disabled={creating}>
                  {creating ? "만드는 중…" : "모임 만들기"}
                </button>
                {!isAdmin && (
                  <p className="break-keep text-xs text-steel-400">새 모임은 운영자가 확인한 뒤 찾기에 보여요.</p>
                )}
              </form>
            ) : (
              <div className="dg-steel space-y-3 p-4">
                <h2 className="font-display text-lg">모임 만들기</h2>
                <p className="break-keep text-sm text-steel-300">로그인하면 우리 모임을 만들고 멤버를 모을 수 있어요.</p>
                <Link to="/login?next=/gyms" className="dg-btn dg-btn-primary min-h-[44px] w-full text-sm">
                  로그인하고 만들기
                </Link>
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
