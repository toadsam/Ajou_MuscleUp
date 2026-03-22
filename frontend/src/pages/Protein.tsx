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

  return (
    <section className="min-h-screen overflow-hidden bg-gradient-to-br from-[#0d0f12] via-[#151826] to-[#0b0d14] px-5 pb-20 pt-28 text-white lg:px-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,106,46,0.18),_transparent_55%)]" />
      <div className="absolute -top-24 right-0 h-72 w-72 bg-orange-500/20 blur-[120px]" />
      <div className="absolute bottom-10 left-0 h-80 w-80 bg-emerald-500/20 blur-[140px]" />

      <div className="relative mx-auto max-w-6xl space-y-8">
        <header className="grid gap-6 rounded-[30px] border border-white/10 bg-gradient-to-br from-orange-500/18 via-amber-400/10 to-white/5 p-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.5em] text-emerald-300/80">Protein Share Crew</p>
            <h1 className="text-4xl font-extrabold leading-tight md:text-6xl">
              프로틴 공동구매 모집방
              <span className="block text-orange-200">대표 구매자가 사고, 참가자가 N빵하는 구조</span>
            </h1>
            <p className="max-w-2xl text-sm text-gray-300">
              이곳은 쇼핑몰이 아니라 지역 기반 공동구매 모집방입니다. 대표 구매자가 대량 구매하고,
              참가자는 1인 부담금만 내고 소분 분배받습니다.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setLocationMode("region")}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  locationMode === "region"
                    ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                    : "border-white/20 text-white/70"
                }`}
              >
                지역별로 보기
              </button>
              <button
                type="button"
                onClick={() => setLocationMode("gym")}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  locationMode === "gym"
                    ? "border-orange-400 bg-orange-500/20 text-orange-200"
                    : "border-white/20 text-white/70"
                }`}
              >
                헬스장별로 보기
              </button>
              <Link to="/protein/write" className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-[#0d0f12]">
                공구 모집 등록
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1">
            {[
              { title: "대표 구매자", desc: "한 사람이 대표로 구매하고 분배를 진행합니다." },
              { title: "참가자 N빵", desc: "전체 금액을 인원수로 나눠 1인 부담금을 줄입니다." },
              { title: "외부 공유 가능", desc: "공구 링크를 복사하거나 공유해서 다른 플랫폼에 보낼 수 있습니다." },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="font-semibold">{item.title}</div>
                <p className="mt-2 text-sm text-white/60">{item.desc}</p>
              </div>
            ))}
          </div>
        </header>

        <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 lg:grid-cols-[0.7fr,1fr]">
          <div>
            <div className="text-sm font-semibold">공구 찾기</div>
            <p className="mt-1 text-xs text-white/55">지역, 헬스장, 모집 상태로 빠르게 걸러보세요.</p>
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs text-white/60">
              <select
                className="rounded-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
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
                className="rounded-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                value={selectedGym}
                onChange={(e) => setSelectedGym(e.target.value)}
              >
                {locationOptions.gyms.map((gym) => (
                  <option key={gym} value={gym} className="bg-[#0d0f12]">
                    {gym}
                  </option>
                ))}
              </select>
              <select
                className="rounded-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {["전체", "모집 중", "모집 마감", "분배 완료"].map((item) => (
                  <option key={item} value={item} className="bg-[#0d0f12]">
                    {item}
                  </option>
                ))}
              </select>
              <select
                className="rounded-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                value={distributionFilter}
                onChange={(e) => setDistributionFilter(e.target.value)}
              >
                {["전체", "직접 분배", "헬스장 보관"].map((item) => (
                  <option key={item} value={item} className="bg-[#0d0f12]">
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={sortByDays} className="rounded-full bg-white/5 px-4 py-2 text-sm hover:bg-white/10">
                마감 임박순
              </button>
              <button onClick={sortByPriceAsc} className="rounded-full bg-white/5 px-4 py-2 text-sm hover:bg-white/10">
                1인 부담 낮은 순
              </button>
              <button onClick={sortByPriceDesc} className="rounded-full bg-white/5 px-4 py-2 text-sm hover:bg-white/10">
                총 금액 높은 순
              </button>
            </div>
          </div>
        </div>

        {shareMessage && (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {shareMessage}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {highlights.map((p) => {
            const { region } = parseLocation(p.category);
            const perPrice =
              typeof p.price === "number" && typeof p.goal === "number" && p.goal > 0
                ? Math.ceil(p.price / p.goal)
                : null;
            return (
              <div key={`highlight-${p.id}`} className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <div className="text-xs text-emerald-200">{region}</div>
                <div className="mt-2 text-lg font-semibold">{p.name}</div>
                <div className="mt-2 text-sm text-white/60">{getBeginnerReason(p)}</div>
                <div className="mt-3 text-sm text-orange-200">1인 부담 {perPrice ? `${perPrice.toLocaleString()}원` : "미정"}</div>
              </div>
            );
          })}
        </div>

        {loading && <p className="text-center text-gray-300">공구 목록을 불러오는 중입니다...</p>}
        {err && <p className="text-center text-red-400">{err}</p>}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
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
                <div className="relative">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="h-44 w-full object-cover" />
                  ) : (
                    <div className="flex h-44 items-end bg-gradient-to-br from-orange-500/30 via-amber-200/8 to-transparent p-5">
                      <div>
                        <div className="text-xs uppercase tracking-[0.24em] text-orange-200">Group Buy</div>
                        <div className="mt-2 text-lg font-bold">{region}</div>
                      </div>
                    </div>
                  )}
                  <div className="absolute left-4 top-4 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-emerald-200">{region}</span>
                    <span className="rounded-full bg-orange-400/20 px-3 py-1 text-orange-200">{gym}</span>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <div className="flex items-center justify-between gap-3 text-xs text-white/60">
                    <span>{p.ownerNickname || "대표 구매자 미표시"}</span>
                    <span className="rounded-full bg-white/10 px-3 py-1">{status}</span>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold">{p.name}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/60">{getBeginnerReason(p)}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm text-white/80">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <p className="text-xs text-white/45">총 구매 금액</p>
                      <p className="mt-1 font-semibold">{formatPrice(p.price)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <p className="text-xs text-white/45">1인 부담금</p>
                      <p className="mt-1 font-semibold">{perPrice ? `${perPrice.toLocaleString()}원` : "미정"}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <p className="text-xs text-white/45">목표 인원</p>
                      <p className="mt-1 font-semibold">{p.goal ? `${p.goal}명` : "미정"}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <p className="text-xs text-white/45">분배 방식</p>
                      <p className="mt-1 font-semibold">{distributionType}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-white/60">
                    <div>
                      <span className="font-semibold text-emerald-200">{rating.toFixed(1)}</span>
                      <span className="ml-1">신뢰 후기 평점</span>
                    </div>
                    <div>{p.days ? `${p.days}일 남음` : "마감일 미정"}</div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleShare(p.id, p.name)}
                      className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/75"
                    >
                      링크 공유
                    </button>
                    <Link
                      to={`/reviews?proteinId=${p.id}`}
                      className="rounded-full border border-emerald-400/30 px-4 py-2 text-sm text-emerald-200"
                    >
                      후기 보기
                    </Link>
                    <Link
                      to={`/proteins/${p.id}`}
                      className="flex-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-center text-sm font-semibold text-white"
                    >
                      모집글 보기
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {!loading && !err && filtered.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
            조건에 맞는 공동구매 모집글이 없습니다.
          </div>
        )}
      </div>
    </section>
  );
}
