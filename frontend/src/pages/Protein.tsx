import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

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
  ownerNickname?: string | null;
};

type LocationMode = "region" | "gym";

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
    alert("로그인이 필요합니다.");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (res.status === 403) {
    alert("권한이 없습니다.");
    throw new Error("Forbidden");
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return res.json();
}

async function fetchProteins(): Promise<Protein[]> {
  const data = await api<any>("/api/proteins");
  return Array.isArray(data) ? data : (data.content ?? []);
}

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

const getDistributionType = (description?: string) => {
  if (!description) return "직접 분배";
  if (description.includes("보관")) return "헬스장 보관";
  if (description.includes("직접")) return "직접 분배";
  return "직접 분배";
};

const getStatus = (days?: number, rating?: number | null) => {
  if (typeof days === "number" && days <= 0) {
    return (rating ?? 0) > 0 ? "분배 완료" : "모집 마감";
  }
  return "모집 중";
};

const getBeginnerReason = (protein: Protein) => {
  const perPerson =
    typeof protein.price === "number" && typeof protein.goal === "number" && protein.goal > 0
      ? Math.ceil(protein.price / protein.goal)
      : null;

  if ((protein.avgRating ?? 0) >= 4.3) return "후기 평점이 높아서 초보도 선택하기 편해요.";
  if (perPerson !== null && perPerson <= 30000) return "1인 부담금이 낮아서 처음 공동구매 참여하기 좋아요.";
  if ((protein.days ?? 99) <= 3) return "곧 마감되는 모집이라 빠르게 합류하기 좋아요.";
  return "지역 기반 소분 공구라 직접 만나서 분배받기 쉬워요.";
};

export default function Protein() {
  const [products, setProducts] = useState<Protein[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [locationMode, setLocationMode] = useState<LocationMode>("region");
  const [selectedRegion, setSelectedRegion] = useState("전체 지역");
  const [selectedGym, setSelectedGym] = useState("전체 헬스장");
  const [statusFilter, setStatusFilter] = useState("전체");
  const [distributionFilter, setDistributionFilter] = useState("전체");
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setProducts(await fetchProteins());
      } catch (e: any) {
        setErr(e.message ?? "목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!shareMessage) return;
    const timer = window.setTimeout(() => setShareMessage(null), 2200);
    return () => window.clearTimeout(timer);
  }, [shareMessage]);

  const sortByPriceAsc = () =>
    setProducts((p) => [...p].sort((a, b) => (a.price ?? 0) - (b.price ?? 0)));
  const sortByPriceDesc = () =>
    setProducts((p) => [...p].sort((a, b) => (b.price ?? 0) - (a.price ?? 0)));
  const sortByDays = () =>
    setProducts((p) => [...p].sort((a, b) => (a.days ?? 9e9) - (b.days ?? 9e9)));

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
    return products.filter((p) => {
      const { region, gym } = parseLocation(p.category);
      const status = getStatus(p.days, p.avgRating);
      const distributionType = getDistributionType(p.description);
      const regionOk = selectedRegion === "전체 지역" || region === selectedRegion;
      const gymOk = selectedGym === "전체 헬스장" || gym === selectedGym;
      const locationOk = locationMode === "region" ? regionOk : gymOk;
      const statusOk = statusFilter === "전체" || status === statusFilter;
      const distributionOk = distributionFilter === "전체" || distributionType === distributionFilter;
      return locationOk && statusOk && distributionOk;
    });
  }, [distributionFilter, locationMode, products, selectedGym, selectedRegion, statusFilter]);

  const highlights = filtered.slice(0, 3);

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
        setShareMessage("공구 링크를 복사했습니다.");
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
            <p className="font-num text-sm font-bold text-plate-green">Protein Share Crew</p>
            <h1 className="text-4xl leading-tight md:text-6xl">
              프로틴 공동구매 모집방
              <span className="mt-2 block font-sans text-xl font-bold text-orange-300 md:text-2xl">대표 구매자가 사고, 참가자가 N빵하는 구조</span>
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
                공구 모집 등록
              </Link>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-1">
            {[
              { title: "대표 구매자", desc: "한 사람이 대표로 구매하고 분배를 진행합니다.", plate: "bg-plate-red" },
              { title: "참가자 N빵", desc: "전체 금액을 인원수로 나눠 1인 부담금을 줄입니다.", plate: "bg-plate-blue" },
              { title: "외부 공유 가능", desc: "공구 링크를 복사하거나 공유해서 다른 플랫폼에 보낼 수 있습니다.", plate: "bg-plate-yellow" },
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

        <div className="dg-well grid gap-4 p-4 lg:grid-cols-[0.7fr,1fr]">
          <div>
            <div className="font-display text-lg">공구 찾기</div>
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
                {["전체", "모집 중", "모집 마감", "분배 완료"].map((item) => (
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
                {["전체", "직접 분배", "헬스장 보관"].map((item) => (
                  <option key={item} value={item} className="bg-steel-900">
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={sortByDays} className={SORT_CHIP}>
                마감 임박순
              </button>
              <button onClick={sortByPriceAsc} className={SORT_CHIP}>
                1인 부담 낮은 순
              </button>
              <button onClick={sortByPriceDesc} className={SORT_CHIP}>
                총 금액 높은 순
              </button>
            </div>
          </div>
        </div>

        {shareMessage && (
          <div className="dg-pop dg-well border-l-[6px] border-l-plate-green px-4 py-3 text-sm font-semibold text-green-200">
            {shareMessage}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {highlights.map((p, idx) => {
            const { region } = parseLocation(p.category);
            const perPrice =
              typeof p.price === "number" && typeof p.goal === "number" && p.goal > 0
                ? Math.ceil(p.price / p.goal)
                : null;
            return (
              <div
                key={`highlight-${p.id}`}
                className="dg-rise dg-lift rounded-xl border-[3px] border-black border-t-[8px] border-t-plate-yellow bg-steel-800 p-5 shadow-md"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <div className="text-xs font-bold text-green-300">{region}</div>
                <div className="mt-2 text-lg font-bold">{p.name}</div>
                <div className="mt-2 text-sm text-steel-300">{getBeginnerReason(p)}</div>
                <div className="mt-3 text-sm font-semibold text-orange-300">
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
            공구 목록을 불러오는 중입니다...
          </p>
        )}
        {err && <p className="text-center text-red-300">{err}</p>}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p, idx) => {
            const rating = p.avgRating ?? 0;
            const status = getStatus(p.days, p.avgRating);
            const distributionType = getDistributionType(p.description);
            const { region, gym } = parseLocation(p.category);
            const perPrice =
              typeof p.price === "number" && typeof p.goal === "number" && p.goal > 0
                ? Math.ceil(p.price / p.goal)
                : null;

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
                        <div className="font-num text-sm font-bold text-orange-300">Group Buy</div>
                        <div className="mt-1 text-lg font-bold">{region}</div>
                      </div>
                    </div>
                  )}
                  <div className="absolute left-3 top-3 flex flex-wrap gap-2 text-xs">
                    <span className="dg-chip bg-plate-green text-white">{region}</span>
                    <span className="dg-chip bg-orange-500 text-black">{gym}</span>
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

                  <div>
                    <h3 className="text-xl font-bold">{p.name}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-steel-300">{getBeginnerReason(p)}</p>
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
                      <p className="mt-1 font-semibold">{distributionType}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-steel-300">
                    <div>
                      <span className="font-num text-base font-black text-green-300">{rating.toFixed(1)}</span>
                      <span className="ml-1">신뢰 후기 평점</span>
                    </div>
                    <div className="font-semibold">{p.days ? `${p.days}일 남음` : "마감일 미정"}</div>
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

        {!loading && !err && filtered.length === 0 && (
          <div className="dg-well p-8 text-center text-steel-400">
            조건에 맞는 공동구매 모집글이 없습니다.
          </div>
        )}
      </div>
    </section>
  );
}
