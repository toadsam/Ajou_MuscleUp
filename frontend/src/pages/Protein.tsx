import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "../lib/toast";
import { friendlyError, httpError } from "../lib/httpError";
import { DISTRIBUTION_METHODS, distributionOf, isClosed, remainingLabel } from "../utils/proteinMeta";

type Protein = {
  id: number;
  name: string;
  price?: number;
  days?: number;
  goal?: number;
  imageUrl?: string; // 공개용 대표 이미지(영수증은 목록에 오지 않는다)
  description?: string;
  category?: string;
  avgRating?: number | null;
  reviewCount?: number;
  ownerNickname?: string | null;
  deadline?: string | null;
  daysLeft?: number | null;
  closed?: boolean;
  distributionMethod?: string | null;
  gymSlug?: string | null;
  gymName?: string | null;
  visibility?: "GYM" | "PUBLIC" | null; // GYM 우리 모임만 · PUBLIC 전체 모집
  region?: string | null;
  maxParticipants?: number | null;
};

type LocationMode = "region" | "gym";

// 목록 범위: all 내가 볼 수 있는 전부 · gym 우리 모임 · public 전체 모집
type Scope = "all" | "gym" | "public";

const SCOPE_TABS: { key: Scope; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "gym", label: "우리 모임" },
  { key: "public", label: "전체 모집" },
];

const SCOPE_STORAGE_KEY = "protein:scope";

// 마지막으로 본 탭(저장소가 막혀 있으면 기본값)
const readSavedScope = (): Scope => {
  try {
    const saved = localStorage.getItem(SCOPE_STORAGE_KEY);
    return saved === "gym" || saved === "public" ? saved : "all";
  } catch {
    return "all";
  }
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;

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

  if (!res.ok) throw await httpError(res, "공동구매 목록을 불러오지 못했어요.");

  return res.json();
}

/** 한 번에 불러오는 글 수(서버 최대 50). 더 있으면 "더 보기"로 다음 묶음 */
const PAGE_SIZE = 24;

type ProteinPage = { items: Protein[]; last: boolean; total: number };

async function fetchProteins(scope: Scope, page: number): Promise<ProteinPage> {
  const data = await api<{ content?: Protein[]; last?: boolean; totalElements?: number } | Protein[]>(
    `/api/proteins?scope=${scope}&size=${PAGE_SIZE}&page=${page}`,
  );
  if (Array.isArray(data)) return { items: data, last: true, total: data.length };
  const items = data.content ?? [];
  return { items, last: data.last ?? items.length < PAGE_SIZE, total: data.totalElements ?? items.length };
}

type SortMode = "latest" | "days" | "perPerson" | "price";

/** 정렬은 불러온 글 전체에 적용한다(더 불러와도 그대로 유지) */
const sortProducts = (list: Protein[], mode: SortMode) => {
  if (mode === "latest") return list;
  const copy = [...list];
  if (mode === "perPerson") return copy.sort((a, b) => (perPersonOf(a) ?? 9e15) - (perPersonOf(b) ?? 9e15));
  if (mode === "price") return copy.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
  // 남은 날이 적은 순. 마감일 없는 글, 마감된 글 순으로 뒤에.
  const key = (x: Protein) => (typeof x.daysLeft === "number" && x.daysLeft >= 0 ? x.daysLeft : x.closed ? 9e9 + 1 : 9e9);
  return copy.sort((a, b) => key(a) - key(b));
};

/** 1인 부담금 = 총 금액 ÷ 목표 인원(둘 중 하나라도 없으면 null) */
const perPersonOf = (p: Protein) =>
  typeof p.price === "number" && typeof p.goal === "number" && p.goal > 0 ? Math.ceil(p.price / p.goal) : null;

const formatPrice = (value?: number) =>
  typeof value === "number" ? `${value.toLocaleString()}원` : "미정";

const parseLocation = (category?: string) => {
  if (!category) return { region: "미정", gym: "미정" };
  const [regionRaw, gymRaw] = category.split("/");
  return {
    region: (regionRaw || "").trim() || "미정",
    gym: (gymRaw || "").trim() || "미정",
  };
};

// 상태는 서버가 마감일로 계산한 closed 만 쓴다(예전: days 숫자가 줄지 않아 영원히 "모집 중")
const getStatus = (p: Protein) => (isClosed(p) ? "모집 마감" : "모집 중");

/** 카드에 보여 줄 사실들(실제 값이 있을 때만). 지어낸 추천 문구는 쓰지 않는다 */
const factsOf = (p: Protein) => {
  const facts: string[] = [];
  if ((p.reviewCount ?? 0) > 0 && typeof p.avgRating === "number") {
    facts.push(`후기 ${p.reviewCount}개 · 평균 ${p.avgRating.toFixed(1)}점`);
  }
  const method = distributionOf(p);
  if (method) facts.push(`분배: ${method}`);
  return facts;
};

/** 모집 범위 칩: 우리 모임(파랑, 모임 이름은 길면 자른다) · 전체 모집(노랑) */
function VisibilityChip({ visibility, gymName }: { visibility?: Protein["visibility"]; gymName?: string | null }) {
  if (visibility === "PUBLIC") return <span className="dg-chip bg-plate-yellow text-black">전체 모집</span>;
  if (visibility !== "GYM") return null;
  return (
    <span className="dg-chip max-w-full bg-plate-blue text-white">
      <span className="flex-none">우리 모임</span>
      {gymName && <span className="min-w-0 max-w-[9rem] truncate font-sans font-bold">· {gymName}</span>}
    </span>
  );
}

export default function Protein() {
  const [products, setProducts] = useState<Protein[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [locationMode, setLocationMode] = useState<LocationMode>("region");
  const [selectedRegion, setSelectedRegion] = useState("전체 지역");
  const [selectedGym, setSelectedGym] = useState("전체 헬스장");
  const [statusFilter, setStatusFilter] = useState("전체");
  const [distributionFilter, setDistributionFilter] = useState("전체");
  const [scope, setScope] = useState<Scope>(readSavedScope);
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  // 페이지 넘김: 지금까지 불러온 페이지, 더 있는지, 전체 개수
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  // "더 보기" 도중 탭을 바꾸면 늦게 온 응답을 버린다
  const scopeRef = useRef(scope);
  useEffect(() => {
    scopeRef.current = scope;
  }, [scope]);

  useEffect(() => {
    // 탭을 빨리 바꾸면 늦게 온 이전 응답이 덮어쓰지 않게 막는다
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const first = await fetchProteins(scope, 0);
        if (!cancelled) {
          setProducts(first.items);
          setPage(0);
          setHasMore(!first.last);
          setTotal(first.total);
        }
      } catch (e) {
        if (!cancelled) {
          setProducts([]);
          setHasMore(false);
          setErr(friendlyError(e, "공동구매 목록을 불러오지 못했어요."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope]);

  const changeScope = (next: Scope) => {
    setScope(next);
    try {
      localStorage.setItem(SCOPE_STORAGE_KEY, next);
    } catch {
      // 저장소가 막혀 있어도 탭 전환은 그대로 된다
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const requested = scope;
    try {
      const next = await fetchProteins(requested, page + 1);
      if (requested !== scopeRef.current) return;
      // 그사이 새 글이 올라와 밀린 글이 겹칠 수 있어 번호로 한 번 거른다
      setProducts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...next.items.filter((p) => !seen.has(p.id))];
      });
      setPage((n) => n + 1);
      setHasMore(!next.last);
      setTotal(next.total);
    } catch (e) {
      toast(friendlyError(e, "더 불러오지 못했어요. 잠시 뒤 다시 해 주세요."), "error");
    } finally {
      setLoadingMore(false);
    }
  };

  const locationOptions = useMemo(() => {
    const regions = new Set<string>();
    const gyms = new Set<string>();
    products.forEach((p) => {
      const { region, gym } = parseLocation(p.category);
      regions.add(region);
      gyms.add(gym);
    });
    return {
      regions: ["전체 지역", ...Array.from(regions)],
      gyms: ["전체 헬스장", ...Array.from(gyms)],
    };
  }, [products]);

  useEffect(() => {
    if (!locationOptions.regions.includes(selectedRegion)) setSelectedRegion("전체 지역");
    if (!locationOptions.gyms.includes(selectedGym)) setSelectedGym("전체 헬스장");
  }, [locationOptions, selectedGym, selectedRegion]);

  const filtered = useMemo(() => {
    return sortProducts(products, sortMode).filter((p) => {
      const { region, gym } = parseLocation(p.category);
      const status = getStatus(p);
      const distributionType = distributionOf(p) ?? "정보 없음";
      const regionOk = selectedRegion === "전체 지역" || region === selectedRegion;
      const gymOk = selectedGym === "전체 헬스장" || gym === selectedGym;
      const locationOk = locationMode === "region" ? regionOk : gymOk;
      const statusOk = statusFilter === "전체" || status === statusFilter;
      const distributionOk = distributionFilter === "전체" || distributionType === distributionFilter;
      return locationOk && statusOk && distributionOk;
    });
  }, [distributionFilter, locationMode, products, selectedGym, selectedRegion, sortMode, statusFilter]);

  // 위 세 칸은 아직 모집 중인 글만
  const highlights = filtered.filter((p) => !isClosed(p)).slice(0, 3);

  const handleShare = async (proteinId: number, proteinName: string) => {
    const url = `${window.location.origin}/proteins/${proteinId}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${proteinName} 공동구매`,
          text: "프로틴 공동구매 모집 링크입니다.",
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast("공동구매 링크를 복사했어요.", "success");
      }
    } catch {
      // user cancelled
    }
  };

  const locationTabs: { key: LocationMode; label: string }[] = [
    { key: "region", label: "지역별로 보기" },
    { key: "gym", label: "헬스장별로 보기" },
  ];
  const locationTabIndex = locationTabs.findIndex((t) => t.key === locationMode);
  const SELECT =
    "rounded-md border-2 border-black bg-steel-800 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-steel-700 focus:border-plate-yellow";
  const SORT_CHIP =
    "rounded-md border-[3px] border-black bg-steel-700 px-4 py-2 text-sm font-bold text-steel-100 shadow transition-all duration-100 hover:-translate-y-0.5 hover:shadow-md active:translate-y-[3px] active:shadow-none";

  return (
    <section className="relative min-h-screen overflow-hidden px-5 pb-20 pt-28 text-white lg:px-12">
      <div className="relative mx-auto max-w-6xl space-y-8">
        <header className="dg-steel grid gap-6 p-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-4">
            <p className="font-num text-sm font-bold text-plate-green">GROUP BUY</p>
            <h1 className="text-4xl leading-tight md:text-6xl">
              프로틴 공동구매 모집방
              <span className="mt-2 block font-sans text-xl font-bold text-plate-yellow md:text-2xl">대표 구매자가 사고, 참가자가 N빵하는 구조</span>
            </h1>
            <p className="max-w-2xl text-sm text-steel-300">
              이곳은 쇼핑몰이 아니라 지역 기반 공동구매 모집방입니다. 대표 구매자가 대량 구매하고,
              참가자는 1인 부담금만 내고 소분 분배받습니다.
            </p>
            <div className="flex flex-wrap items-end gap-4">
              <div className="relative inline-grid grid-cols-2 border-b-2 border-steel-700" role="tablist">
                {locationTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={locationMode === tab.key}
                    onClick={() => setLocationMode(tab.key)}
                    className={`px-4 pb-2 pt-1 text-sm font-bold transition-colors ${
                      locationMode === tab.key ? "text-white" : "text-steel-400 hover:text-steel-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
                <span
                  aria-hidden
                  className="absolute -bottom-[2px] left-0 h-1 w-1/2 bg-plate-red transition-transform duration-300 ease-out"
                  style={{ transform: `translateX(${locationTabIndex * 100}%)` }}
                />
              </div>
              <Link to="/protein/write" className="dg-btn dg-btn-primary min-h-[44px] px-5 text-sm">
                공동구매 모집 등록
              </Link>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-1">
            {[
              { title: "대표 구매자", desc: "한 사람이 대표로 구매하고 분배를 진행합니다.", plate: "bg-plate-red" },
              { title: "참가자 N빵", desc: "전체 금액을 인원수로 나눠 1인 부담금을 줄입니다.", plate: "bg-plate-blue" },
              { title: "외부 공유 가능", desc: "공동구매 링크를 복사하거나 공유해서 다른 플랫폼에 보낼 수 있습니다.", plate: "bg-plate-yellow" },
            ].map((item, idx) => (
              <div key={item.title} className="dg-well dg-rise flex gap-3 p-4" style={{ animationDelay: `${idx * 60}ms` }}>
                <span aria-hidden className={`mt-0.5 h-8 w-2.5 flex-none rounded-sm border-2 border-black ${item.plate}`} />
                <div>
                  <div className="font-bold">{item.title}</div>
                  <p className="mt-1 text-sm text-steel-300">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </header>

        {/* 모집 범위 탭: 서버가 scope 로 걸러 준다(우리 모임 글은 그 모임 멤버에게만 온다) */}
        <div className="relative grid grid-cols-3 border-b-2 border-steel-700 sm:inline-grid" role="tablist" aria-label="모집 범위">
          {SCOPE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={scope === tab.key}
              onClick={() => changeScope(tab.key)}
              className={`min-h-[44px] px-5 pb-2 pt-1 text-base font-black transition-colors ${
                scope === tab.key ? "text-white" : "text-steel-400 hover:text-steel-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
          <span
            aria-hidden
            className="absolute -bottom-[2px] left-0 h-1 w-1/3 bg-plate-red transition-transform duration-300 ease-out"
            style={{ transform: `translateX(${SCOPE_TABS.findIndex((t) => t.key === scope) * 100}%)` }}
          />
        </div>

        <div className="dg-well grid gap-4 p-4 lg:grid-cols-[0.7fr,1fr]">
          <div>
            <div className="font-display text-lg">공동구매 찾기</div>
            <p className="mt-1 text-xs text-steel-400">지역, 헬스장, 모집 상태로 빠르게 걸러보세요.</p>
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs text-steel-300">
              <select
                className={SELECT}
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
              >
                {locationOptions.regions.map((region) => (
                  <option key={region} value={region} className="bg-steel-900">
                    {region}
                  </option>
                ))}
              </select>
              <select
                className={SELECT}
                value={selectedGym}
                onChange={(e) => setSelectedGym(e.target.value)}
              >
                {locationOptions.gyms.map((gym) => (
                  <option key={gym} value={gym} className="bg-steel-900">
                    {gym}
                  </option>
                ))}
              </select>
              <select
                className={SELECT}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {["전체", "모집 중", "모집 마감"].map((item) => (
                  <option key={item} value={item} className="bg-steel-900">
                    {item}
                  </option>
                ))}
              </select>
              <select
                className={SELECT}
                value={distributionFilter}
                onChange={(e) => setDistributionFilter(e.target.value)}
              >
                {["전체", ...DISTRIBUTION_METHODS, "정보 없음"].map((item) => (
                  <option key={item} value={item} className="bg-steel-900">
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["latest", "최신순"],
                  ["days", "마감 임박순"],
                  ["perPerson", "1인 부담 낮은 순"],
                  ["price", "총 금액 높은 순"],
                ] as [SortMode, string][]
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={sortMode === mode}
                  onClick={() => setSortMode(mode)}
                  className={`${SORT_CHIP} ${sortMode === mode ? "!bg-plate-yellow !text-black" : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {highlights.map((p, idx) => {
            const { region } = parseLocation(p.category);
            const perPrice = perPersonOf(p);
            return (
              <div
                key={`highlight-${p.id}`}
                className="dg-rise dg-lift rounded-xl border-[3px] border-black border-t-[8px] border-t-plate-yellow bg-steel-800 p-5 shadow-md"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <div className="text-xs font-bold text-green-300">{region}</div>
                <div className="mt-2 text-lg font-bold">{p.name}</div>
                <div className="mt-2 text-sm text-steel-300">{remainingLabel(p)}</div>
                <div className="mt-3 text-sm font-semibold text-plate-yellow">
                  1인 부담 <span className="font-num text-xl font-black">{perPrice ? `${perPrice.toLocaleString()}원` : "미정"}</span>
                </div>
              </div>
            );
          })}
        </div>

        {loading && (
          <p className="flex items-center justify-center gap-3 text-center text-steel-300">
            <span className="dg-loading-plates" aria-label="불러오는 중">
              <i />
              <i />
              <i />
              <i />
            </span>
            공동구매 목록을 불러오는 중입니다...
          </p>
        )}
        {err && <p className="text-center text-red-300">{err}</p>}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p, idx) => {
            const status = getStatus(p);
            const distributionType = distributionOf(p);
            const facts = factsOf(p);
            const { region, gym } = parseLocation(p.category);
            const perPrice = perPersonOf(p);

            return (
              <article
                key={p.id}
                className="dg-lift dg-rise group relative overflow-hidden rounded-xl border-[3px] border-black bg-steel-800 shadow-md"
                style={{ animationDelay: `${Math.min(idx, 12) * 50}ms` }}
              >
                <div className="relative border-b-[3px] border-black">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="h-44 w-full object-cover" />
                  ) : (
                    <div className="dg-rubber flex h-44 items-end p-5">
                      <div>
                        <div className="text-sm font-bold text-plate-yellow">공동구매</div>
                        <div className="mt-1 text-lg font-bold">{region}</div>
                      </div>
                    </div>
                  )}
                  <div className="absolute left-3 top-3 flex flex-wrap gap-2 text-xs">
                    <span className="dg-chip bg-plate-green text-white">{region}</span>
                    <span className="dg-chip bg-plate-yellow text-black">{gym}</span>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <div className="flex items-center justify-between gap-3 text-xs text-steel-300">
                    <span>{p.ownerNickname || "대표 구매자 미표시"}</span>
                    <span
                      className={`dg-chip text-xs ${
                        status === "모집 중" ? "bg-plate-yellow text-black" : "bg-steel-700 text-steel-200"
                      }`}
                    >
                      {status}
                    </span>
                  </div>

                  {(p.visibility || p.region) && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <VisibilityChip visibility={p.visibility} gymName={p.gymName} />
                      {p.region && <span className="truncate text-steel-300">{p.region}</span>}
                    </div>
                  )}

                  <div>
                    <h3 className="text-xl font-bold">{p.name}</h3>
                    {facts.length > 0 && (
                      <p className="mt-2 text-sm leading-relaxed text-steel-300">{facts.join(" · ")}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm text-steel-100">
                    <div className="dg-well p-3">
                      <p className="text-xs text-steel-400">총 구매 금액</p>
                      <p className="font-num mt-1 text-lg font-black">{formatPrice(p.price)}</p>
                    </div>
                    <div className="dg-well p-3">
                      <p className="text-xs text-steel-400">1인 부담금</p>
                      <p className="font-num mt-1 text-lg font-black text-plate-yellow">{perPrice ? `${perPrice.toLocaleString()}원` : "미정"}</p>
                    </div>
                    <div className="dg-well p-3">
                      <p className="text-xs text-steel-400">목표 인원</p>
                      <p className="font-num mt-1 text-lg font-black">{p.goal ? `${p.goal}명` : "미정"}</p>
                    </div>
                    <div className="dg-well p-3">
                      <p className="text-xs text-steel-400">분배 방식</p>
                      <p className="mt-1 font-semibold">{distributionType ?? "정보 없음"}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-steel-300">
                    <div>
                      {(p.reviewCount ?? 0) > 0 && typeof p.avgRating === "number" ? (
                        <>
                          <span className="font-num text-base font-black text-green-300">{p.avgRating.toFixed(1)}</span>
                          <span className="ml-1">후기 평균 ({p.reviewCount}개)</span>
                        </>
                      ) : (
                        <span>아직 후기 없음</span>
                      )}
                    </div>
                    <div className={`font-semibold ${isClosed(p) ? "text-steel-500" : ""}`}>{remainingLabel(p)}</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleShare(p.id, p.name)}
                      className="dg-btn dg-btn-steel dg-chalk-burst min-h-[40px] px-3 text-sm"
                    >
                      링크 공유
                    </button>
                    <Link to={`/reviews?proteinId=${p.id}`} className="dg-btn dg-btn-steel min-h-[40px] px-3 text-sm">
                      후기 보기
                    </Link>
                    <Link to={`/proteins/${p.id}`} className="dg-btn dg-btn-primary min-h-[40px] flex-1 px-3 text-sm">
                      모집글 보기
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {!loading && !err && products.length > 0 && (
          <div className="flex flex-col items-center gap-2">
            <p className="font-num text-xs text-steel-400">
              {products.length} / {total}개 불러옴
              {hasMore && " · 지역 · 상태 · 정렬은 불러온 글 안에서 적용돼요"}
            </p>
            {hasMore && (
              <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="dg-btn dg-btn-steel min-h-[44px] px-6 text-sm">
                {loadingMore ? "불러오는 중…" : "더 보기"}
              </button>
            )}
          </div>
        )}

        {!loading && !err && filtered.length === 0 && (
          <div className="dg-well space-y-4 p-8 text-center text-steel-400">
            {products.length > 0 ? (
              // 서버엔 글이 있는데 위 필터에 걸린 경우
              <p>조건에 맞는 공동구매 모집글이 없습니다.</p>
            ) : scope === "gym" ? (
              <>
                <p>우리 모임에서 열린 공동구매가 아직 없어요.</p>
                <Link to="/protein/write" className="dg-btn dg-btn-primary min-h-[44px] px-5 text-sm">
                  우리 모임 공동구매 열기
                </Link>
              </>
            ) : scope === "public" ? (
              <>
                <p>지금 전체 모집 중인 공동구매가 없어요.</p>
                <button type="button" onClick={() => changeScope("all")} className="dg-btn dg-btn-steel min-h-[44px] px-5 text-sm">
                  전체 목록 보기
                </button>
              </>
            ) : (
              <>
                <p>아직 공동구매 모집글이 없어요.</p>
                <Link to="/protein/write" className="dg-btn dg-btn-primary min-h-[44px] px-5 text-sm">
                  첫 공동구매 열기
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
