import { useEffect, useState } from "react";
import UploadDropzone from "../components/UploadDropzone";

type MediaItem = {
  title: string;
  desc: string;
  tag: string;
  image: string;
};

const highlights: MediaItem[] = [
  {
    title: "바디 프로필 캠페인",
    desc: "10명의 회원이 도전한 바디 프로필 스토리를 결과까지 담았어요.",
    tag: "브랜디드",
    image: "https://images.unsplash.com/photo-1518611012118-696072aa579a",
  },
  {
    title: "12주 준비 다큐",
    desc: "12주 준비 과정, 운동·루틴·마인드셋까지 기록한 미니 다큐.",
    tag: "다큐",
    image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438",
  },
  {
    title: "브랜딩 워크숍 세션",
    desc: "스폰서 브랜드와 함께한 커뮤니티 촬영 & 콘텐츠 제작.",
    tag: "콜라보",
    image: "https://images.unsplash.com/photo-1526506118085-60ce8714f8c5",
  },
];

export default function Gallery() {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchList = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/files/list?folder=gallery`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      const data: string[] = await res.json();
      setImages(data);
    } catch (e: any) {
      setError(e?.message || "미디어를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  return (
    <section className="relative min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black px-6 pb-20 pt-28 text-white lg:px-10">
      <div className="glow-orb absolute -left-32 top-0 h-80 w-80 rounded-full bg-pink-500/25" />
      <div className="glow-orb absolute right-0 top-20 h-96 w-96 rounded-full bg-indigo-500/25" />

      <div className="relative mx-auto max-w-6xl space-y-12">
        <header className="grid gap-6 lg:grid-cols-2 lg:items-center">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.25em] text-pink-200">Media Studio</p>
            <h1 className="text-3xl md:text-4xl font-extrabold">브랜드 스토리를 담은 미디어</h1>
            <p className="text-gray-200 leading-relaxed">
              회원님의 성장 기록과, 팀이 함께 만든 캠페인·다큐·하이라이트 콘텐츠를 모았습니다.
              기획부터 촬영, 후반 작업까지 전담 스튜디오에서 책임집니다.
            </p>
            <div className="flex gap-3 flex-wrap text-sm">
              <span className="rounded-full bg-white/10 px-4 py-2 border border-white/10">브랜디드 콘텐츠</span>
              <span className="rounded-full bg-white/10 px-4 py-2 border border-white/10">바디 프로필</span>
              <span className="rounded-full bg-white/10 px-4 py-2 border border-white/10">다큐·하이라이트</span>
              <span className="rounded-full bg-white/10 px-4 py-2 border border-white/10">커뮤니티 촬영</span>
            </div>
            <div className="flex gap-3">
              <a
                href="mailto:contact@example.com"
                className="btn-gradient px-6 py-3 rounded-xl font-semibold"
              >
                촬영 문의
              </a>
              <a
                href="/programs"
                className="px-6 py-3 rounded-xl border border-white/20 text-sm hover:bg-white/10"
              >
                제작 프로세스 보기
              </a>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-xl">
            <UploadDropzone onUploaded={() => fetchList()} />
            <p className="mt-3 text-sm text-gray-300">
              내부 미디어 스튜디오 업로드 존입니다. 로그인된 계정에 반영돼요.
            </p>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-3">
          {highlights.map((item) => (
            <div
              key={item.title}
              className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur shadow-lg hover:shadow-pink-500/30 transition"
            >
              <div className="relative h-44">
                <img src={`${item.image}?auto=format&fit=crop&w=800&q=80`} className="h-full w-full object-cover" alt={item.title} />
                <span className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-xs text-pink-200 border border-white/10">
                  {item.tag}
                </span>
              </div>
              <div className="p-5 space-y-2">
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="text-sm text-gray-300">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">최근 업로드</h2>
            {loading && <p className="text-sm text-gray-400">불러오는 중...</p>}
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {images.map((src) => (
              <div key={src} className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
                <img src={src} className="w-full h-48 object-cover" alt="media" />
              </div>
            ))}
            {images.length === 0 && !loading && (
              <div className="col-span-full text-sm text-gray-400">아직 업로드된 미디어가 없습니다.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
