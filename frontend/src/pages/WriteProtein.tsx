import { useState } from "react";
import { useNavigate } from "react-router-dom";

// 작은 API 유틸: BASE가 있으면 붙이고, 없으면 상대경로(/api/...) 그대로 사용
const BASE = import.meta.env.VITE_API_BASE ?? "";
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const url = BASE ? `${BASE}${path}` : path;
  const token = localStorage.getItem("token");
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...authHeader, ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`);
  }
  return res.json();
}

// 생성용 페이로드 타입(백엔드 필드명에 맞춰 사용)
type CreateProteinPayload = {
  name: string;
  price: number;
  days: number;
  goal: number;
  imageUrl?: string;
  description?: string;
  category?: string;
};

// 서버가 반환하는 타입(필요 최소만)
type Protein = CreateProteinPayload & { id: number; avgRating?: number | null };

export default function WriteProtein() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    price: "",
    days: "",
    goal: "",
    image: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    // 간단한 전처리 & 검증
    const price = Number(form.price);
    const days = Number(form.days);
    const goal = Number(form.goal);
    if (Number.isNaN(price) || Number.isNaN(days) || Number.isNaN(goal)) {
      setErr("가격/기간/목표 인원은 숫자여야 합니다.");
      return;
    }
    if (price < 0 || days <= 0 || goal <= 0) {
      setErr("가격은 0 이상, 기간·목표 인원은 1 이상이어야 합니다.");
      return;
    }

    const payload: CreateProteinPayload = {
      name: form.name.trim(),
      price,
      days,
      goal,
      imageUrl: form.image.trim() || undefined,
    };

    try {
      setSubmitting(true);
      // ✅ 실제 API 호출
      const created = await api<Protein>("/api/proteins", {
        method: "POST",
        body: JSON.stringify(payload),
        // credentials: "include", // 세션/쿠키 쓰면 주석 해제
      });

      alert("공동구매 상품이 등록되었습니다!");
      // 생성된 상세로 이동 (백엔드가 id 반환한다고 가정)
      navigate(`/proteins/${created.id}`);
    } catch (e: any) {
      setErr(e?.message ?? "등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="pt-32 p-12 min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white">
      <div className="max-w-2xl mx-auto bg-gray-800/70 backdrop-blur-md p-8 rounded-2xl shadow-xl">
        <h2 className="text-3xl font-extrabold mb-8 text-center">공동구매 등록</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block mb-2">상품 이름</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              className="w-full p-3 rounded bg-gray-900 border border-gray-600 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block mb-2">가격 (₩)</label>
            <input
              type="number"
              name="price"
              value={form.price}
              onChange={handleChange}
              className="w-full p-3 rounded bg-gray-900 border border-gray-600 focus:outline-none"
              required
              min={0}
            />
          </div>

          <div>
            <label className="block mb-2">남은 기간 (일)</label>
            <input
              type="number"
              name="days"
              value={form.days}
              onChange={handleChange}
              className="w-full p-3 rounded bg-gray-900 border border-gray-600 focus:outline-none"
              required
              min={1}
            />
          </div>

          <div>
            <label className="block mb-2">목표 인원</label>
            <input
              type="number"
              name="goal"
              value={form.goal}
              onChange={handleChange}
              className="w-full p-3 rounded bg-gray-900 border border-gray-600 focus:outline-none"
              required
              min={1}
            />
          </div>

          <div>
            <label className="block mb-2">상품 이미지 URL</label>
            <input
              type="text"
              name="image"
              value={form.image}
              onChange={handleChange}
              className="w-full p-3 rounded bg-gray-900 border border-gray-600 focus:outline-none"
              placeholder="https://example.com/product.jpg"
            />
          </div>

          {err && <p className="text-red-400 text-sm">{err}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-60"
          >
            {submitting ? "등록 중..." : "등록하기"}
          </button>
        </form>
      </div>
    </section>
  );
}
