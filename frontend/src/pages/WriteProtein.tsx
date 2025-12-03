import { useState } from "react";
import { useNavigate } from "react-router-dom";
import UploadDropzone from "../components/UploadDropzone";

const BASE = import.meta.env.VITE_API_BASE ?? "";
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const url = BASE ? `${BASE}${path}` : path;
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const res = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
  });
  if (res.status === 401) {
    alert("로그인이 필요합니다.");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`);
  }
  return res.json();
}

type CreateProteinPayload = {
  name: string;
  price: number;
  days: number;
  goal: number;
  imageUrl?: string;
  description?: string;
  category?: string;
};

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

    const price = Number(form.price);
    const days = Number(form.days);
    const goal = Number(form.goal);
    if (Number.isNaN(price) || Number.isNaN(days) || Number.isNaN(goal)) {
      setErr("가격/기간/목표 인원은 숫자여야 해요.");
      return;
    }
    if (price < 0 || days <= 0 || goal <= 0) {
      setErr("가격은 0 이상, 기간·목표 인원은 1 이상이어야 해요.");
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
      const created = await api<Protein>("/api/proteins", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      alert("공동구매 상품이 등록되었습니다.");
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
            <label className="block mb-2">가격</label>
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
            <label className="block mb-2">진행 기간 (일)</label>
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

          <div className="space-y-3">
            <label className="block">상품 이미지 (올려도 되고 URL 입력도 가능)</label>
            <UploadDropzone
              accept="image/*"
              multiple={false}
              onUploaded={(url) => setForm((prev) => ({ ...prev, image: url }))}
            />
            <input
              type="text"
              name="image"
              value={form.image}
              onChange={handleChange}
              className="w-full p-3 rounded bg-gray-900 border border-gray-600 focus:outline-none"
              placeholder="https://example.com/product.jpg"
            />
            {form.image && (
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="text-sm text-gray-300 mb-2">미리보기</p>
                <img src={form.image} alt="preview" className="w-full h-48 object-cover rounded-lg" />
              </div>
            )}
          </div>

          {err && <p className="text-red-400 text-sm">{err}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-60"
          >
            {submitting ? "등록 중.." : "등록하기"}
          </button>
        </form>
      </div>
    </section>
  );
}
