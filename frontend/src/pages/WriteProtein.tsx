import { useMemo, useState } from "react";
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

type DistributionType = "직접 만남" | "헬스장 보관함";

export default function WriteProtein() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    price: "",
    days: "",
    goal: "",
    image: "",
    region: "",
    gym: "",
    brand: "",
    totalCapacity: "",
    perCapacity: "",
    distributionType: "직접 만남" as DistributionType,
    distributionLocation: "",
    detailNote: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const canSubmit = useMemo(() => {
    return form.name.trim() && (form.region.trim() || form.gym.trim());
  }, [form.name, form.region, form.gym]);

  const buildDescription = () => {
    const lines = [
      form.brand.trim() ? `브랜드: ${form.brand.trim()}` : null,
      form.totalCapacity.trim() ? `총 용량: ${form.totalCapacity.trim()}` : null,
      form.perCapacity.trim() ? `1인 분배: ${form.perCapacity.trim()}` : null,
      form.distributionType ? `분배 방식: ${form.distributionType}` : null,
      form.distributionLocation.trim() ? `분배 위치: ${form.distributionLocation.trim()}` : null,
      form.detailNote.trim() ? `추가 설명: ${form.detailNote.trim()}` : null,
    ].filter(Boolean);
    return lines.join("\n");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    const price = Number(form.price);
    const days = Number(form.days);
    const goal = Number(form.goal);
    if (Number.isNaN(price) || Number.isNaN(days) || Number.isNaN(goal)) {
      setErr("가격/기간/목표 인원은 숫자여야 합니다.");
      return;
    }
    if (price < 0 || days <= 0 || goal <= 0) {
      setErr("가격은 0 이상, 기간/목표 인원은 1 이상이어야 합니다.");
      return;
    }
    if (!form.region.trim() && !form.gym.trim()) {
      setErr("지역 또는 헬스장 중 하나는 반드시 입력해야 합니다.");
      return;
    }

    const category = `${form.region.trim() || "미지정"}/${form.gym.trim() || "미지정"}`;
    const payload: CreateProteinPayload = {
      name: form.name.trim(),
      price,
      days,
      goal,
      imageUrl: form.image.trim() || undefined,
      description: buildDescription(),
      category,
    };

    try {
      setSubmitting(true);
      const created = await api<Protein>("/api/proteins", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      alert("나눔 모집글이 등록되었습니다.");
      navigate(`/proteins/${created.id}`);
    } catch (e: any) {
      setErr(e?.message ?? "등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="pt-28 px-6 lg:px-12 min-h-screen bg-gradient-to-br from-[#0d0f12] via-[#151826] to-[#0b0d14] text-white">
      <div className="max-w-3xl mx-auto glass-panel p-8">
        <h2 className="text-3xl font-extrabold mb-6 text-center">나눔형 공동구매 모집글 등록</h2>
        <p className="text-sm text-white/60 text-center mb-8">
          결제는 외부에서 이루어집니다. 지역/헬스장 기준의 나눔 모집글만 작성해 주세요.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block mb-2">제품명</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                className="w-full p-3 rounded bg-black/40 border border-white/10 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block mb-2">브랜드</label>
              <input
                type="text"
                name="brand"
                value={form.brand}
                onChange={handleChange}
                className="w-full p-3 rounded bg-black/40 border border-white/10 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block mb-2">실제 구매 가격</label>
              <input
                type="number"
                name="price"
                value={form.price}
                onChange={handleChange}
                className="w-full p-3 rounded bg-black/40 border border-white/10 focus:outline-none"
                required
                min={0}
              />
            </div>
            <div>
              <label className="block mb-2">모집 기간(일)</label>
              <input
                type="number"
                name="days"
                value={form.days}
                onChange={handleChange}
                className="w-full p-3 rounded bg-black/40 border border-white/10 focus:outline-none"
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
                className="w-full p-3 rounded bg-black/40 border border-white/10 focus:outline-none"
                required
                min={1}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block mb-2">지역 (시/구/동)</label>
              <input
                type="text"
                name="region"
                value={form.region}
                onChange={handleChange}
                className="w-full p-3 rounded bg-black/40 border border-white/10 focus:outline-none"
                placeholder="예: 수원시 영통구 원천동"
              />
            </div>
            <div>
              <label className="block mb-2">헬스장 이름</label>
              <input
                type="text"
                name="gym"
                value={form.gym}
                onChange={handleChange}
                className="w-full p-3 rounded bg-black/40 border border-white/10 focus:outline-none"
                placeholder="예: 아주대 헬스장"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block mb-2">총 용량</label>
              <input
                type="text"
                name="totalCapacity"
                value={form.totalCapacity}
                onChange={handleChange}
                className="w-full p-3 rounded bg-black/40 border border-white/10 focus:outline-none"
                placeholder="예: 2kg"
              />
            </div>
            <div>
              <label className="block mb-2">1인 분배 용량</label>
              <input
                type="text"
                name="perCapacity"
                value={form.perCapacity}
                onChange={handleChange}
                className="w-full p-3 rounded bg-black/40 border border-white/10 focus:outline-none"
                placeholder="예: 500g"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block mb-2">분배 방식</label>
              <div className="flex gap-3">
                {["직접 만남", "헬스장 보관함"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, distributionType: type as DistributionType }))}
                    className={`flex-1 px-4 py-2 rounded-xl border text-sm font-semibold transition ${
                      form.distributionType === type
                        ? "border-orange-400 bg-orange-500/20 text-orange-200"
                        : "border-white/10 text-white/70 hover:border-white/30"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block mb-2">분배 위치</label>
              <input
                type="text"
                name="distributionLocation"
                value={form.distributionLocation}
                onChange={handleChange}
                className="w-full p-3 rounded bg-black/40 border border-white/10 focus:outline-none"
                placeholder="예: 헬스장 1층 보관함 앞"
              />
            </div>
          </div>

          <div>
            <label className="block mb-2">추가 설명</label>
            <textarea
              name="detailNote"
              value={form.detailNote}
              onChange={handleChange}
              className="w-full p-3 rounded bg-black/40 border border-white/10 focus:outline-none min-h-[120px]"
              placeholder="분배 일정, 주의사항 등"
            />
          </div>

          <div className="space-y-3">
            <label className="block">영수증/실구매 인증 이미지</label>
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
              className="w-full p-3 rounded bg-black/40 border border-white/10 focus:outline-none"
              placeholder="https://example.com/receipt.jpg"
            />
            {form.image && (
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="text-sm text-gray-300 mb-2">미리보기</p>
                <img src={form.image} alt="preview" className="w-full h-48 object-cover rounded-lg" />
              </div>
            )}
          </div>

          {!canSubmit && <p className="text-xs text-orange-200">지역 또는 헬스장 중 하나는 필수입니다.</p>}
          {err && <p className="text-red-400 text-sm">{err}</p>}

          <button
            type="submit"
            disabled={submitting || !canSubmit}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3 rounded-xl font-semibold hover:brightness-110 transition disabled:opacity-60"
          >
            {submitting ? "등록 중..." : "나눔 모집글 등록"}
          </button>
        </form>
      </div>
    </section>
  );
}
