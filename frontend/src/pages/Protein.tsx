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
};

type LocationMode = "region" | "gym";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${import.meta.env.VITE_API_BASE}${path}`;

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

const formatPrice = (value?: number) => (typeof value === "number" ? `${value.toLocaleString()}원` : "미정");

const parseLocation = (category?: string) => {
  if (!category) return { region: "미지정", gym: "미지정" };
  const [regionRaw, gymRaw] = category.split("/");
  return {
    region: (regionRaw || "").trim() || "미지정",
    gym: (gymRaw || "").trim() || "미지정",
  };
};

const deriveBrand = (name: string) => {
  const token = name.trim().split(" ")[0];
  return token ? token : "브랜드 미정";
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

export default function Protein() {
  const [products, setProducts] = useState<Protein[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [locationMode, setLocationMode] = useState<LocationMode>("region");
  const [selectedRegion, setSelectedRegion] = useState("전체 지역");
  const [selectedGym, setSelectedGym] = useState("전체 헬스장");
  const [statusFilter, setStatusFilter] = useState("전체");
  const [distributionFilter, setDistributionFilter] = useState("전체");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setProducts(await fetchProteins());
      } catch (e: any) {
        setErr(e.message ?? "로드 실패");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
    if (!locationOptions.regions.includes(selectedRegion)) {
      setSelectedRegion("전체 지역");
    }
    if (!locationOptions.gyms.includes(selectedGym)) {
      setSelectedGym("전체 헬스장");
    }
  }, [locationOptions, selectedRegion, selectedGym]);

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
  }, [products, locationMode, selectedRegion, selectedGym, statusFilter, distributionFilter]);

  const highlights = filtered.slice(0, 5);

  return (
    <section className="relative pt-28 pb-20 px-6 lg:px-12 bg-gradient-to-br from-[#0d0f12] via-[#151826] to-[#0b0d14] min-h-screen text-white overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,106,46,0.18),_transparent_55%)]" />
      <div className="absolute -top-24 right-0 w-72 h-72 bg-orange-500/20 blur-[120px]" />
      <div className="absolute bottom-10 left-0 w-80 h-80 bg-emerald-500/20 blur-[140px]" />

      <div className="relative max-w-6xl mx-auto space-y-10">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] items-end">
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-[0.5em] text-emerald-300/80">Local Protein Share</p>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
              내 동네에서 열리는
              <span className="block text-gradient text-glow">나눔형 단백질 공동구매</span>
            </h1>
            <p className="text-gray-300 max-w-2xl">
              결제는 밖에서, 신뢰와 소통은 여기서. 지역과 헬스장을 중심으로 모이는 나눔 모집글을 한눈에 확인하세요.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setLocationMode("region")}
                className={`px-4 py-2 rounded-full border text-sm font-semibold transition ${
                  locationMode === "region"
                    ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                    : "border-white/20 text-white/70 hover:border-white/40"
                }`}
              >
                내 지역 기준
              </button>
              <button
                type="button"
                onClick={() => setLocationMode("gym")}
                className={`px-4 py-2 rounded-full border text-sm font-semibold transition ${
                  locationMode === "gym"
                    ? "border-orange-400 bg-orange-500/20 text-orange-200"
                    : "border-white/20 text-white/70 hover:border-white/40"
                }`}
              >
                내 헬스장 기준
              </button>
            </div>
          </div>

          <div className="glass-panel p-6 space-y-4">
            <div className="text-sm text-white/70">현재 기준</div>
            <div className="space-y-2">
              <div className="text-2xl font-bold">{locationMode === "region" ? selectedRegion : selectedGym}</div>
              <p className="text-xs text-white/50">
                지역/헬스장을 선택하면 나눔 모집글이 필터링됩니다.
              </p>
            </div>
            <div className="flex flex-col gap-3 text-sm">
              <select
                className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
              >
                {locationOptions.regions.map((region) => (
                  <option key={region} value={region} className="bg-[#0d0f12]">
                    {region}
                  </option>
                ))}
              </select>
              <select
                className="rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
                value={selectedGym}
                onChange={(e) => setSelectedGym(e.target.value)}
              >
                {locationOptions.gyms.map((gym) => (
                  <option key={gym} value={gym} className="bg-[#0d0f12]">
                    {gym}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="glass-panel p-4 md:p-5 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
            <span className="uppercase tracking-[0.25em]">Filter</span>
            <select
              className="rounded-full bg-black/40 border border-white/10 px-3 py-2 text-white text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option className="bg-[#0d0f12]" value="전체">
                상태 전체
              </option>
              {statusSteps.map((step) => (
                <option key={step} value={step} className="bg-[#0d0f12]">
                  {step}
                </option>
              ))}
            </select>
            <select
              className="rounded-full bg-black/40 border border-white/10 px-3 py-2 text-white text-sm"
              value={distributionFilter}
              onChange={(e) => setDistributionFilter(e.target.value)}
            >
              <option className="bg-[#0d0f12]" value="전체">
                분배 방식 전체
              </option>
              <option className="bg-[#0d0f12]" value="직접 만남">
                직접 만남
              </option>
              <option className="bg-[#0d0f12]" value="헬스장 보관함">
                헬스장 보관함
              </option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={sortByDays}
              className="px-4 py-2 bg-white/5 rounded-full text-sm hover:bg-white/10 transition"
            >
              마감 임박순
            </button>
            <button
              onClick={sortByPriceAsc}
              className="px-4 py-2 bg-white/5 rounded-full text-sm hover:bg-white/10 transition"
            >
              1인 부담 낮은 순
            </button>
            <button
              onClick={sortByPriceDesc}
              className="px-4 py-2 bg-white/5 rounded-full text-sm hover:bg-white/10 transition"
            >
              1인 부담 높은 순
            </button>
          </div>
        </div>

        {loading && <p className="text-center text-gray-300">불러오는 중...</p>}
        {err && <p className="text-center text-red-400">{err}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-7">
          {filtered.map((p) => {
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
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl transition hover:-translate-y-1 hover:border-white/20"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition" />
                <div className="relative">
                  {p.imageUrl && (
                    <img src={p.imageUrl} alt={p.name} className="w-full h-44 object-cover" />
                  )}
                  <div className="absolute top-4 left-4 flex flex-wrap gap-2 text-xs">
                    <span className="px-3 py-1 rounded-full bg-emerald-400/20 text-emerald-200">{region}</span>
                    <span className="px-3 py-1 rounded-full bg-orange-400/20 text-orange-200">{gym}</span>
                  </div>
                </div>

                <div className="relative p-6 space-y-4">
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>{deriveBrand(p.name)}</span>
                    <span className="rounded-full px-3 py-1 bg-white/10">{status}</span>
                  </div>
                  <h3 className="text-xl font-bold">{p.name}</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm text-white/80">
                    <div>
                      <p className="text-xs text-white/50">실제 구매 가격</p>
                      <p className="font-semibold">{formatPrice(p.price)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-white/50">1인 부담 금액</p>
                      <p className="font-semibold">{perPrice ? `${perPrice.toLocaleString()}원` : "미정"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-white/50">총 분배 인원</p>
                      <p className="font-semibold">{p.goal ? `${p.goal}명` : "미정"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-white/50">분배 방식</p>
                      <p className="font-semibold">{distributionType}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-white/50">
                      <span>공구 상태</span>
                      <span>{p.days ? `마감까지 ${p.days}일` : "마감 일정 미정"}</span>
                    </div>
                    <div className="flex gap-2">
                      {statusSteps.map((step) => {
                        const isActive = statusSteps.indexOf(step) <= statusSteps.indexOf(status as typeof step);
                        return (
                          <div
                            key={step}
                            className={`flex-1 h-2 rounded-full ${isActive ? "bg-emerald-400" : "bg-white/10"}`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-white/60">
                    <div>
                      <span className="text-emerald-200 font-semibold">{rating.toFixed(1)}</span>
                      <span className="ml-1">평균 평점</span>
                    </div>
                    <div className="text-white/40">신뢰 지표: {Math.round((rating / 5) * 100)}%</div>
                  </div>

                  <Link
                    to={`/proteins/${p.id}`}
                    className="block text-center py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 font-semibold text-white shadow-lg shadow-orange-500/20 hover:brightness-110 transition"
                  >
                    나눔 모집글 보기
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <div className="glass-panel p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">이번 주 우리 동네 나눔 TOP</h3>
            <span className="text-xs text-white/50">최근 올라온 모집글에서 골랐어요</span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {highlights.map((p) => {
              const { region } = parseLocation(p.category);
              const perPrice =
                typeof p.price === "number" && typeof p.goal === "number" && p.goal > 0
                  ? Math.ceil(p.price / p.goal)
                  : null;
              return (
                <div key={`highlight-${p.id}`} className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-2">
                  <p className="text-xs text-emerald-200">{region}</p>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-white/50">
                    1인 부담 {perPrice ? `${perPrice.toLocaleString()}원` : "미정"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-center">
          <Link
            to="/protein/write"
            className="inline-flex items-center justify-center px-7 py-3 rounded-full bg-white text-[#0d0f12] font-semibold shadow-xl shadow-white/10 hover:shadow-white/20 transition"
          >
            나눔 모집글 올리기
          </Link>
        </div>
      </div>
    </section>
  );
}
