import { useEffect, useState } from "react";

export default function Admin() {
  const [status, setStatus] = useState<string>("체크 중...");

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/admin/ping`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        setStatus(res.ok ? "OK" : `에러 ${res.status}`);
      } catch (e: any) {
        setStatus(e?.message || "에러");
      }
    })();
  }, []);

  return (
    <section className="pt-32 p-12 bg-gradient-to-br from-gray-900 via-black to-gray-800 min-h-screen text-white">
      <div className="max-w-6xl mx-auto space-y-8">
        <h1 className="text-4xl md:text-5xl font-extrabold">관리자 대시보드</h1>
        <p className="text-gray-400">백엔드 권한 체크: {status}</p>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { title: "이미지 업로드 관리", href: "/gallery", desc: "갤러리 업로드 및 정리" },
            { title: "상품 관리", href: "/protein", desc: "프로틴 공구 등록/수정" },
            { title: "후기 관리", href: "/reviews", desc: "후기 게시물 모니터링" },
          ].map((c) => (
            <a
              key={c.title}
              href={c.href}
              className="block rounded-2xl p-6 bg-gray-800/70 border border-white/5 hover:shadow-pink-500/30 hover:shadow-xl transition"
            >
              <h3 className="text-xl font-bold mb-2">{c.title}</h3>
              <p className="text-gray-300">{c.desc}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

