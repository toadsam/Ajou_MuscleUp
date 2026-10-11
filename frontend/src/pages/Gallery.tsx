import { useEffect, useMemo, useState } from "react";
import UploadDropzone from "../components/UploadDropzone";
import { useCountUp } from "../hooks/useCountUp";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

// 라벨별 원판 색 칩
const LABEL_CHIP: Record<string, string> = {
  SESSION: "bg-plate-red text-white",
  CHALLENGE: "bg-plate-yellow text-black",
  CREW: "bg-plate-blue text-white",
  SNAP: "bg-steel-700 text-chalk",
};

// 라벨 코드는 파일 이름으로 추정한 분류. 화면에는 한국어로 보여 준다.
const LABEL_TEXT: Record<GalleryCard["label"], string> = {
  SESSION: "운동",
  CHALLENGE: "챌린지",
  CREW: "모임",
  SNAP: "현장",
};

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

// 업로드는 운영진만. 다른 화면(Header, AdminRoute)과 같은 방식으로 저장된 로그인 정보의 role 을 본다.
// 서버도 업로드 권한을 따로 검사하므로 이 값은 "칸을 보여 줄지"만 정한다.
const readIsAdmin = () => {
  try {
    const raw = localStorage.getItem("user");
    const role = raw ? String((JSON.parse(raw) as { role?: string }).role ?? "") : "";
    return role.toUpperCase().includes("ADMIN");
  } catch {
    return false;
  }
};

export default function Gallery() {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAdmin] = useState(readIsAdmin);

  const fetchList = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/files/list?folder=gallery`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("로그인하면 갤러리를 볼 수 있어요.");
        }
        if (res.status === 403) {
          throw new Error("갤러리를 볼 권한이 없어요. 운영진에게 문의해 주세요.");
        }
        throw new Error("갤러리 목록을 불러오지 못했어요. 잠시 뒤에 다시 시도해 주세요.");
      }
      const data: string[] = await res.json();
      setImages(data);
      setActiveIndex(0);
    } catch (e: unknown) {
      setError(e instanceof TypeError ? "서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요." : e instanceof Error ? e.message : "사진을 불러오지 못했어요.");
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
  const isEmpty = !loading && !error && cards.length === 0;

  return (
    <section className="relative min-h-screen overflow-hidden px-6 pb-20 pt-28 text-white lg:px-10">
      <div className="relative mx-auto max-w-6xl space-y-10">
        <header className={`grid gap-6 ${isAdmin ? "lg:grid-cols-[1.3fr_0.7fr]" : ""}`}>
          <div className="dg-steel overflow-hidden p-6 md:p-8">
            <p className="text-sm font-bold text-plate-yellow">사진 보관함</p>
            <h1 className="mt-2 text-3xl md:text-5xl">갤러리</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-steel-300 md:text-base">
              동아리 운동·행사 사진을 모아 두는 곳이에요. 사진을 누르면 위에서 크게 볼 수 있어요.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="dg-well px-4 py-3">
                <p className="text-xs text-steel-400">올라온 사진</p>
                <p className="font-num mt-1 text-4xl font-black text-plate-yellow">{Math.round(uploadCount)}</p>
              </div>
              <div className="dg-well px-4 py-3">
                <p className="text-xs text-steel-400">보고 있는 사진</p>
                <p key={activeIndex} className="dg-pop mt-1 text-lg font-semibold text-yellow-200">
                  {heroImage ? `${activeIndex + 1}번째` : "없음"}
                </p>
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="dg-steel p-6">
              <p className="mb-3 text-sm font-bold text-plate-yellow">운영진 전용 · 사진 올리기</p>
              <UploadDropzone onUploaded={() => fetchList()} />
              <p className="mt-3 text-sm text-steel-300">
                올리면 목록이 바로 새로고침돼요. 반영까지 몇 초 걸릴 수 있어요.
              </p>
              <div className="dg-well mt-4 border-l-[6px] border-l-plate-yellow px-4 py-3 text-xs text-steel-200">
                JPG·PNG, 긴 변 2000px 이하를 권장해요.
              </div>
            </div>
          )}
        </header>

        {error && cards.length === 0 ? (
          <div className="dg-well border-l-[6px] border-l-plate-red px-6 py-10 text-center">
            <p className="font-display text-2xl text-chalk">사진을 불러오지 못했어요</p>
            <p className="mt-2 text-sm text-steel-300">{error}</p>
          </div>
        ) : isEmpty ? (
          <div className="dg-well px-6 py-14 text-center">
            <p className="font-display text-2xl text-chalk">아직 올라온 사진이 없어요</p>
            <p className="mt-2 text-sm text-steel-400">
              {isAdmin ? "위의 사진 올리기 칸에서 첫 사진을 올려 주세요." : "운영진이 활동 사진을 올리면 여기에 모여요."}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl">크게 보기</h2>
                {loading && (
                  <p className="flex items-center gap-2 text-sm text-steel-400">
                    <span className="dg-loading-plates" aria-hidden="true">
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
                  <img
                    key={heroImage}
                    src={heroImage}
                    className="dg-pop h-[360px] w-full object-contain md:h-[460px]"
                    alt={`크게 보는 갤러리 사진 ${activeIndex + 1}번째`}
                  />
                ) : (
                  <div className="flex h-[360px] items-center justify-center text-sm text-steel-400">
                    {loading ? "사진을 불러오는 중이에요." : "보여 줄 사진이 없어요."}
                  </div>
                )}
              </div>
              {error && (
                <div className="dg-well border-l-4 border-l-plate-red px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}
            </div>

            {cards.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-2xl">전체 사진</h2>
                  <p className="text-sm text-steel-400">누르면 위에서 크게 보여요.</p>
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
                        alt={`갤러리 사진 ${idx + 1}번째`}
                      />
                      <div className="flex items-center justify-between border-t-[3px] border-black bg-steel-900 px-3 py-2">
                        <span className={`dg-chip text-xs ${LABEL_CHIP[item.label]}`}>{LABEL_TEXT[item.label]}</span>
                        <p className="font-num text-base font-black text-chalk">#{String(idx + 1).padStart(2, "0")}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
