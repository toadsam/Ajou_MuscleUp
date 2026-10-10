import { useEffect, useMemo, useState } from "react";
import UploadDropzone from "../components/UploadDropzone";
import { useCountUp } from "../hooks/useCountUp";

// 라벨별 원판 색 칩
const LABEL_CHIP: Record<string, string> = {
  SESSION: "bg-plate-red text-white",
  CHALLENGE: "bg-plate-yellow text-black",
  CREW: "bg-plate-blue text-white",
  SNAP: "bg-steel-700 text-chalk",
  TRAINING: "bg-plate-red text-white",
  STORY: "bg-plate-blue text-white",
  EVENT: "bg-plate-yellow text-black",
};

type MediaItem = {
  title: string;
  desc: string;
  tag: string;
  image: string;
};

const editorialCuts: MediaItem[] = [
  {
    title: "Power Session",
    desc: "고강도 세션의 분위기를 살린 시퀀스로, 동작의 힘과 리듬을 기록합니다.",
    tag: "TRAINING",
    image: "https://images.unsplash.com/photo-1518611012118-696072aa579a",
  },
  {
    title: "Team Story",
    desc: "멤버별 성장 구간을 짧은 다큐 톤으로 편집해 한눈에 볼 수 있게 구성합니다.",
    tag: "STORY",
    image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438",
  },
  {
    title: "Community Frame",
    desc: "행사, 챌린지, 현장 스냅까지 커뮤니티의 밀도를 담아내는 아카이브 컷입니다.",
    tag: "EVENT",
    image: "https://images.unsplash.com/photo-1526506118085-60ce8714f8c5",
  },
];

type GalleryCard = {
  src: string;
  label: "SESSION" | "CHALLENGE" | "CREW" | "SNAP";
};

const inferLabel = (src: string): GalleryCard["label"] => {
  const token = src.toLowerCase();
  if (token.includes("challenge")) return "CHALLENGE";
  if (token.includes("crew") || token.includes("team")) return "CREW";
  if (token.includes("session") || token.includes("workout")) return "SESSION";
  return "SNAP";
};

export default function Gallery() {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const fetchList = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/files/list?folder=gallery`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("로그인이 필요합니다. 로그인 후 갤러리를 다시 불러와 주세요.");
        }
        if (res.status === 403) {
          throw new Error("갤러리 조회 권한이 없습니다. 관리자에게 권한을 요청해 주세요.");
        }
        throw new Error("갤러리 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
      const data: string[] = await res.json();
      setImages(data);
      setActiveIndex(0);
    } catch (e: any) {
      setError(e?.message || "미디어를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const cards = useMemo<GalleryCard[]>(
    () => images.map((src) => ({ src, label: inferLabel(src) })),
    [images],
  );

  const heroImage = cards[activeIndex]?.src ?? null;
  const uploadCount = useCountUp(images.length, { duration: 800 });

  return (
    <section className="relative min-h-screen overflow-hidden px-6 pb-20 pt-28 text-white lg:px-10">
      <div className="relative mx-auto max-w-6xl space-y-10">
        <header className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="dg-steel overflow-hidden p-6 md:p-8">
            <p className="font-num text-sm font-bold text-plate-yellow">Archive Lab</p>
            <h1 className="mt-2 text-3xl md:text-5xl">갤러리 아카이브</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-steel-300 md:text-base">
              운동 기록과 커뮤니티 장면을 하나의 보드로 구성한 페이지입니다.
              업로드 즉시 아카이브에 반영되고, 대표 컷은 우측 프리뷰에서 바로 확인할 수 있습니다.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="dg-well px-4 py-3">
                <p className="text-xs text-steel-400">총 업로드</p>
                <p className="font-num mt-1 text-4xl font-black text-plate-yellow">{Math.round(uploadCount)}</p>
              </div>
              <div className="dg-well px-4 py-3">
                <p className="text-xs text-steel-400">상태</p>
                <p className="mt-1 flex items-center gap-2 text-lg font-semibold text-green-300">
                  <span
                    aria-hidden
                    className={`h-2.5 w-2.5 rounded-full border border-black ${loading ? "animate-pulse bg-plate-yellow" : "bg-plate-green"}`}
                  />
                  {loading ? "동기화 중" : "준비 완료"}
                </p>
              </div>
              <div className="dg-well px-4 py-3">
                <p className="text-xs text-steel-400">대표 컷</p>
                <p key={activeIndex} className="dg-pop mt-1 text-lg font-semibold text-yellow-200">
                  {heroImage ? `${activeIndex + 1}번 선택됨` : "미선택"}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href="mailto:contact@example.com"
                className="dg-btn dg-btn-primary px-5 text-sm"
              >
                촬영 문의
              </a>
              <a
                href="/programs"
                className="dg-btn dg-btn-steel px-5 text-sm"
              >
                제작 프로세스 보기
              </a>
            </div>
          </div>

          <div className="dg-steel p-6">
            <UploadDropzone onUploaded={() => fetchList()} />
            <p className="mt-3 text-sm text-steel-300">
              업로드 직후 자동 새로고침됩니다. 첫 반영까지 수 초가 걸릴 수 있어요.
            </p>
            <div className="dg-well mt-4 border-l-[6px] border-l-plate-yellow px-4 py-3 text-xs text-steel-200">
              권장: JPG/PNG, 긴 변 2000px 이하, 파일명에 session/challenge/team 키워드를 넣으면 자동 라벨링됩니다.
            </div>
          </div>
        </header>

        <div className="grid gap-5 md:grid-cols-3">
          {editorialCuts.map((item, idx) => (
            <div
              key={item.title}
              className="dg-lift dg-rise group overflow-hidden rounded-xl border-[3px] border-black bg-steel-800 shadow-md"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <div className="relative h-44 overflow-hidden border-b-[3px] border-black">
                <img
                  src={`${item.image}?auto=format&fit=crop&w=800&q=80`}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                  alt={item.title}
                />
                <span className={`dg-chip absolute left-3 top-3 text-sm ${LABEL_CHIP[item.tag] ?? "bg-steel-700 text-chalk"}`}>
                  {item.tag}
                </span>
              </div>
              <div className="p-5 space-y-2">
                <h3 className="font-num text-2xl font-black text-white">{item.title}</h3>
                <p className="text-sm text-steel-300">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">대표 프리뷰</h2>
              {loading && (
                <p className="flex items-center gap-2 text-sm text-steel-400">
                  <span className="dg-loading-plates" aria-label="불러오는 중">
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  불러오는 중...
                </p>
              )}
            </div>
            <div className="overflow-hidden rounded-xl border-[3px] border-black bg-steel-900 shadow-xl">
              {heroImage ? (
                <img key={heroImage} src={heroImage} className="dg-pop h-[360px] w-full object-cover" alt="featured media" />
              ) : (
                <div className="flex h-[360px] items-center justify-center text-sm text-steel-400">
                  아직 대표로 선택할 이미지가 없습니다.
                </div>
              )}
            </div>
            {error && (
              <div className="dg-well border-l-4 border-l-plate-red px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">빠른 선택</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 self-start sm:grid-cols-3 lg:grid-cols-2">
              {cards.map((item, idx) => (
                <button
                  key={`${item.src}-${idx}`}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  aria-pressed={idx === activeIndex}
                  className={`group relative overflow-hidden rounded-lg border-[3px] transition duration-150 ${
                    idx === activeIndex
                      ? "translate-y-[3px] border-plate-yellow shadow-none"
                      : "border-black shadow-md hover:-translate-y-0.5 hover:shadow-lg"
                  }`}
                >
                  <img src={item.src} className="h-28 w-full object-cover" alt={`media-${idx + 1}`} />
                  <span className={`dg-chip absolute left-1.5 top-1.5 text-xs ${LABEL_CHIP[item.label]}`}>
                    {item.label}
                  </span>
                </button>
              ))}
              {cards.length === 0 && !loading && (
                <div className="dg-well col-span-full px-4 py-8 text-center text-sm text-steel-400">
                  업로드된 이미지가 아직 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">아카이브 보드</h2>
            <p className="text-sm text-steel-400">클릭하면 대표 프리뷰로 선택됩니다.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((item, idx) => (
              <button
                key={`${item.src}-board-${idx}`}
                type="button"
                onClick={() => setActiveIndex(idx)}
                aria-pressed={idx === activeIndex}
                className={`dg-lift dg-rise group relative overflow-hidden rounded-xl border-[3px] bg-steel-900 text-left shadow-md ${
                  idx % 5 === 0 ? "lg:col-span-2" : ""
                } ${idx === activeIndex ? "border-plate-yellow" : "border-black"}`}
                style={{ animationDelay: `${Math.min(idx, 12) * 50}ms` }}
              >
                <img
                  src={item.src}
                  className={`w-full object-cover transition duration-300 group-hover:scale-[1.02] ${
                    idx % 5 === 0 ? "h-64" : "h-44"
                  }`}
                  alt={`archive-${idx + 1}`}
                />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-8">
                  <span className={`dg-chip text-xs ${LABEL_CHIP[item.label]}`}>{item.label}</span>
                  <p className="font-num text-base font-black text-chalk">#{String(idx + 1).padStart(2, "0")}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
