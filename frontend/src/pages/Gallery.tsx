import { useEffect, useState } from "react";
import UploadDropzone from "../components/UploadDropzone";

export default function Gallery() {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchList = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/files/list`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error(await res.text());
      const data: string[] = await res.json();
      setImages(data);
    } catch (e: any) {
      setError(e?.message || "로드 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(); }, []);

  return (
    <section className="pt-32 p-12 bg-gradient-to-br from-gray-900 via-black to-gray-800 min-h-screen text-white">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-extrabold text-center mb-10">갤러리</h1>

        <div className="max-w-3xl mx-auto mb-10">
          <UploadDropzone onUploaded={() => fetchList()} />
        </div>

        {loading && <p className="text-center text-gray-300">불러오는 중...</p>}
        {error && <p className="text-center text-red-400">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {images.map((src) => (
            <div key={src} className="rounded-2xl overflow-hidden bg-gray-800/70 border border-white/5">
              <img src={src} className="w-full h-56 object-cover" alt="gallery" />
            </div>
          ))}
          {images.length === 0 && !loading && (
            <div className="text-center text-gray-400 col-span-full">아직 업로드된 이미지가 없습니다.</div>
          )}
        </div>
      </div>
    </section>
  );
}
