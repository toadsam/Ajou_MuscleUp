import { useEffect, useMemo, useState } from "react";
import UploadDropzone from "../components/UploadDropzone";

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

  return (
    <section className="relative min-h-screen overflow-hidden bg-slate-950 px-6 pb-20 pt-28 text-white lg:px-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="absolute right-0 top-14 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-rose-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl space-y-10">
        <header className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 p-6 shadow-[0_20px_70px_-40px_rgba(34,211,238,0.7)] md:p-8">
            <p className="inline-flex rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
              Archive Lab
            </p>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight md:text-5xl">갤러리 아카이브</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-200 md:text-base">
              운동 기록과 커뮤니티 장면을 하나의 보드로 구성한 페이지입니다.
              업로드 즉시 아카이브에 반영되고, 대표 컷은 우측 프리뷰에서 바로 확인할 수 있습니다.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
                <p className="text-xs text-slate-300">총 업로드</p>
                <p className="mt-1 text-2xl font-bold text-cyan-100">{images.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
                <p className="text-xs text-slate-300">상태</p>
                <p className="mt-1 text-lg font-semibold text-emerald-200">
                  {loading ? "동기화 중" : "준비 완료"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
                <p className="text-xs text-slate-300">대표 컷</p>
                <p className="mt-1 text-lg font-semibold text-amber-100">
                  {heroImage ? `${activeIndex + 1}번 선택됨` : "미선택"}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href="mailto:contact@example.com"
                className="rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                촬영 문의
              </a>
              <a
                href="/programs"
                className="rounded-xl border border-white/20 px-5 py-2.5 text-sm font-semibold hover:bg-white/10"
              >
                제작 프로세스 보기
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/65 p-6 shadow-[0_16px_45px_-30px_rgba(251,191,36,0.7)] backdrop-blur">
            <UploadDropzone onUploaded={() => fetchList()} />
            <p className="mt-3 text-sm text-slate-300">
              업로드 직후 자동 새로고침됩니다. 첫 반영까지 수 초가 걸릴 수 있어요.
            </p>
            <div className="mt-4 rounded-2xl border border-amber-200/20 bg-amber-400/10 px-4 py-3 text-xs text-amber-50">
              권장: JPG/PNG, 긴 변 2000px 이하, 파일명에 session/challenge/team 키워드를 넣으면 자동 라벨링됩니다.
            </div>
          </div>
        </header>

        <div className="grid gap-5 md:grid-cols-3">
          {editorialCuts.map((item) => (
            <div
              key={item.title}
              className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 shadow-[0_12px_35px_-25px_rgba(244,114,182,0.85)] backdrop-blur transition hover:-translate-y-1"
            >
              <div className="relative h-44">
                <img
                  src={`${item.image}?auto=format&fit=crop&w=800&q=80`}
                  className="h-full w-full object-cover"
                  alt={item.title}
                />
                <span className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-xs text-cyan-100">
                  {item.tag}
                </span>
              </div>
              <div className="p-5 space-y-2">
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="text-sm text-slate-300">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">대표 프리뷰</h2>
              {loading && <p className="text-sm text-slate-400">불러오는 중...</p>}
            </div>
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60">
              {heroImage ? (
                <img src={heroImage} className="h-[360px] w-full object-cover" alt="featured media" />
              ) : (
                <div className="flex h-[360px] items-center justify-center text-sm text-slate-400">
                  아직 대표로 선택할 이미지가 없습니다.
                </div>
              )}
            </div>
            {error && (
              <div className="rounded-2xl border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">빠른 선택</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 self-start sm:grid-cols-3 lg:grid-cols-2">
              {cards.map((item, idx) => (
                <button
                  key={`${item.src}-${idx}`}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={`group relative overflow-hidden rounded-2xl border transition ${
                    idx === activeIndex
                      ? "border-cyan-200/70 ring-2 ring-cyan-300/40"
                      : "border-white/10 hover:border-cyan-200/35"
                  }`}
                >
                  <img src={item.src} className="h-28 w-full object-cover" alt={`media-${idx + 1}`} />
                  <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
                    {item.label}
                  </span>
                </button>
              ))}
              {cards.length === 0 && !loading && (
                <div className="col-span-full rounded-2xl border border-white/10 bg-slate-900/50 px-4 py-8 text-center text-sm text-slate-400">
                  업로드된 이미지가 아직 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight">아카이브 보드</h2>
            <p className="text-sm text-slate-400">클릭하면 대표 프리뷰로 선택됩니다.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((item, idx) => (
              <button
                key={`${item.src}-board-${idx}`}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={`group relative overflow-hidden rounded-2xl border bg-slate-900/60 text-left transition hover:-translate-y-1 ${
                  idx % 5 === 0 ? "lg:col-span-2" : ""
                } ${
                  idx === activeIndex
                    ? "border-amber-200/60 shadow-[0_12px_40px_-24px_rgba(251,191,36,0.9)]"
                    : "border-white/10"
                }`}
              >
                <img
                  src={item.src}
                  className={`w-full object-cover transition duration-300 group-hover:scale-[1.02] ${
                    idx % 5 === 0 ? "h-64" : "h-44"
                  }`}
                  alt={`archive-${idx + 1}`}
                />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-8">
                  <p className="text-xs font-semibold tracking-[0.16em] text-cyan-100">{item.label}</p>
                  <p className="text-xs text-slate-200">#{String(idx + 1).padStart(2, "0")}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
