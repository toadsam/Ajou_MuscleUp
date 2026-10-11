import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import UploadDropzone from "../components/UploadDropzone";
import { toast } from "../lib/toast";
import { friendlyError, httpError } from "../lib/httpError";
import { DISTRIBUTION_METHODS } from "../utils/proteinMeta";

const BASE = import.meta.env.VITE_API_BASE ?? "";
// 글쓰기 입력칸: 철판 안쪽의 어두운 칸 + 포커스 시 노란 외곽선. 16px 이상이라 iOS 가 확대하지 않는다
const FIELD =
  "dg-well w-full p-3 text-base text-white placeholder:text-steel-500 transition-colors focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow";
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
    toast("로그인이 필요해요.", "error");
    window.location.href = "/login";
    throw await httpError(res, "로그인이 필요해요.");
  }
  if (!res.ok) throw await httpError(res, "공동구매 모집글을 등록하지 못했어요.");
  return res.json();
}

type CreateProteinPayload = {
  name: string;
  price: number;
  days: number;
  goal: number;
  imageUrl?: string; // 대표 이미지(목록에 공개)
  receiptUrl?: string; // 영수증(작성자 · 관리자 · 승인된 참여자만)
  distributionMethod?: string;
  description?: string;
  category?: string;
  gymSlug?: string; // 어느 모임에서 여는지(우리 모임만일 때)
  visibility: Visibility;
  region?: string;
  maxParticipants?: number;
};

type Protein = CreateProteinPayload & { id: number; avgRating?: number | null };

type DistributionType = (typeof DISTRIBUTION_METHODS)[number] | "";

// 모집 범위: GYM 우리 모임만 · PUBLIC 전체 모집(가입 7일 · 운동 3일 이후, 서버가 확인)
type Visibility = "GYM" | "PUBLIC";

// GET /api/gyms/mine 에서 쓰는 값만
type MyGym = {
  slug: string;
  name: string;
  type?: string;
  status?: string;
};

export default function WriteProtein() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    price: "",
    days: "",
    goal: "",
    image: "",
    receipt: "",
    region: "",
    gym: "",
    brand: "",
    totalCapacity: "",
    perCapacity: "",
    distributionType: "" as DistributionType,
    distributionLocation: "",
    detailNote: "",
    maxParticipants: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [myGyms, setMyGyms] = useState<MyGym[]>([]);
  const [visibility, setVisibility] = useState<Visibility>("GYM");
  const [gymSlug, setGymSlug] = useState("");

  // 내 모임 중 운영 중(ACTIVE)인 곳만 고를 수 있다. 못 불러와도 전체 모집은 쓸 수 있다
  useEffect(() => {
    let cancelled = false;
    // 로그인 안내는 등록 버튼에서 하므로 여기선 401 이어도 이동시키지 않는다
    fetch(`${BASE}/api/gyms/mine`, { credentials: "include" })
      .then((res) => (res.ok ? (res.json() as Promise<MyGym[]>) : []))
      .then((list) => {
        if (!cancelled) setMyGyms(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setMyGyms([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeGyms = useMemo(() => myGyms.filter((g) => g.status === "ACTIVE"), [myGyms]);
  // 고를 모임이 없으면 전체 모집만. 고른 모임이 없으면 첫 모임
  const effectiveVisibility: Visibility = activeGyms.length === 0 ? "PUBLIC" : visibility;
  const selectedGym = activeGyms.find((g) => g.slug === gymSlug) ?? activeGyms[0];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // 우리 모임만이면 모임이 곧 장소라 지역 · 헬스장 칸을 비워도 된다
  const canSubmit = useMemo(() => {
    const placed = form.region.trim() || form.gym.trim() || (effectiveVisibility === "GYM" && selectedGym);
    return form.name.trim() && placed;
  }, [form.name, form.region, form.gym, effectiveVisibility, selectedGym]);

  const buildDescription = () => {
    const lines = [
      form.brand.trim() ? `브랜드: ${form.brand.trim()}` : null,
      form.totalCapacity.trim() ? `총 용량: ${form.totalCapacity.trim()}` : null,
      form.perCapacity.trim() ? `1인 분배: ${form.perCapacity.trim()}` : null,
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
    if (!canSubmit) {
      setErr("지역 또는 헬스장 중 하나는 반드시 입력해야 합니다.");
      return;
    }
    const maxParticipants = form.maxParticipants.trim() ? Number(form.maxParticipants) : undefined;
    if (maxParticipants !== undefined && (!Number.isInteger(maxParticipants) || maxParticipants < 2 || maxParticipants > 500)) {
      setErr("최대 인원은 2명에서 500명 사이로 적어 주세요.");
      return;
    }

    const asGym = effectiveVisibility === "GYM" ? selectedGym : undefined;
    const category = `${form.region.trim() || "미지정"}/${form.gym.trim() || asGym?.name || "미지정"}`;
    const payload: CreateProteinPayload = {
      name: form.name.trim(),
      price,
      days,
      goal,
      imageUrl: form.image.trim() || undefined,
      receiptUrl: form.receipt.trim() || undefined,
      distributionMethod: form.distributionType || undefined,
      description: buildDescription(),
      category,
      gymSlug: asGym?.slug,
      visibility: effectiveVisibility,
      region: form.region.trim() || undefined,
      maxParticipants,
    };

    try {
      setSubmitting(true);
      const created = await api<Protein>("/api/proteins", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast("공동구매 모집글을 등록했어요.", "success");
      navigate(`/proteins/${created.id}`);
    } catch (e) {
      // 전체 모집 조건이 안 되면 서버가 403 + 한국어 사유를 준다
      const message = friendlyError(e, "공동구매 모집글을 등록하지 못했어요.");
      setErr(message);
      toast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="pt-28 pb-16 px-6 lg:px-12 min-h-screen text-white">
      <div className="dg-steel dg-rise max-w-3xl mx-auto p-8">
        <h2 className="font-display text-3xl mb-6 text-center">공동구매 모집글 등록</h2>
        <p className="text-sm text-steel-300 text-center mb-8">
          결제는 외부에서 이루어집니다. 지역/헬스장 기준의 공동구매 모집글만 작성해 주세요.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm font-semibold text-steel-200">모집 범위</legend>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="모집 범위">
              {([
                { key: "GYM", label: "우리 모임만" },
                { key: "PUBLIC", label: "전체 모집" },
              ] as const).map((opt) => {
                const disabled = opt.key === "GYM" && activeGyms.length === 0;
                const on = effectiveVisibility === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={disabled}
                    onClick={() => setVisibility(opt.key)}
                    className={`min-h-[44px] rounded-md border-[3px] border-black px-3 py-2 text-base font-bold transition-all duration-100 disabled:cursor-not-allowed disabled:opacity-50 ${
                      on
                        ? "translate-y-[3px] bg-plate-yellow text-black shadow-none"
                        : "bg-steel-700 text-steel-200 shadow enabled:hover:-translate-y-0.5 enabled:hover:shadow-md"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {activeGyms.length === 0 && (
              <p className="text-xs text-steel-400">가입한 운동 모임이 없어서 전체 모집으로만 열 수 있어요.</p>
            )}
            {effectiveVisibility === "GYM" && selectedGym && (
              <div>
                <label htmlFor="protein-gym-scope" className="block mb-2 text-sm font-semibold text-steel-200">
                  어느 모임에서 여나요?
                </label>
                <select
                  id="protein-gym-scope"
                  value={selectedGym.slug}
                  onChange={(e) => setGymSlug(e.target.value)}
                  className={FIELD}
                >
                  {activeGyms.map((g) => (
                    <option key={g.slug} value={g.slug} className="bg-steel-900">
                      {g.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-steel-400">이 모임 멤버에게만 보여요.</p>
              </div>
            )}
            {effectiveVisibility === "PUBLIC" && (
              <p className="dg-well border-l-4 border-l-plate-yellow p-3 text-sm text-steel-200">
                전체 모집은 가입 7일 · 운동 3일 이후에 열 수 있어요. 모르는 사람과 거래하니 송금 전에 꼭 확인해요.
              </p>
            )}
          </fieldset>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block mb-2 text-sm font-semibold text-steel-200">제품명</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                className={FIELD}
                required
              />
            </div>
            <div>
              <label className="block mb-2 text-sm font-semibold text-steel-200">브랜드</label>
              <input
                type="text"
                name="brand"
                value={form.brand}
                onChange={handleChange}
                className={FIELD}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block mb-2 text-sm font-semibold text-steel-200">실제 구매 가격</label>
              <input
                type="number"
                name="price"
                value={form.price}
                onChange={handleChange}
                className={FIELD}
                required
                min={0}
              />
            </div>
            <div>
              <label htmlFor="protein-days" className="block mb-2 text-sm font-semibold text-steel-200">모집 기간(일)</label>
              <input
                id="protein-days"
                type="number"
                name="days"
                value={form.days}
                onChange={handleChange}
                className={FIELD}
                required
                min={1}
                max={365}
                aria-describedby="protein-days-hint"
              />
              <p id="protein-days-hint" className="mt-1 text-xs text-steel-400">
                오늘부터 센 날짜가 지나면 자동으로 마감돼요.
              </p>
            </div>
            <div>
              <label className="block mb-2 text-sm font-semibold text-steel-200">목표 인원</label>
              <input
                type="number"
                name="goal"
                value={form.goal}
                onChange={handleChange}
                className={FIELD}
                required
                min={1}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="protein-max" className="block mb-2 text-sm font-semibold text-steel-200">
                최대 인원 <span className="text-xs font-normal text-steel-400">(선택)</span>
              </label>
              <input
                id="protein-max"
                type="number"
                inputMode="numeric"
                name="maxParticipants"
                value={form.maxParticipants}
                onChange={handleChange}
                className={FIELD}
                min={2}
                max={500}
                aria-describedby="protein-max-hint"
              />
              <p id="protein-max-hint" className="mt-1 text-xs text-steel-400">
                다 차면 더 이상 신청을 받지 않아요. (2~500명)
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="protein-region" className="block mb-2 text-sm font-semibold text-steel-200">
                지역 (시/구/동) <span className="text-xs font-normal text-steel-400">(선택)</span>
              </label>
              <input
                id="protein-region"
                type="text"
                name="region"
                value={form.region}
                onChange={handleChange}
                className={FIELD}
                maxLength={40}
                placeholder="예: 수원시 영통구 원천동"
              />
            </div>
            <div>
              <label className="block mb-2 text-sm font-semibold text-steel-200">헬스장 이름</label>
              <input
                type="text"
                name="gym"
                value={form.gym}
                onChange={handleChange}
                className={FIELD}
                placeholder="예: 아주대 헬스장"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block mb-2 text-sm font-semibold text-steel-200">총 용량</label>
              <input
                type="text"
                name="totalCapacity"
                value={form.totalCapacity}
                onChange={handleChange}
                className={FIELD}
                placeholder="예: 2kg"
              />
            </div>
            <div>
              <label className="block mb-2 text-sm font-semibold text-steel-200">1인 분배 용량</label>
              <input
                type="text"
                name="perCapacity"
                value={form.perCapacity}
                onChange={handleChange}
                className={FIELD}
                placeholder="예: 500g"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="block mb-2 text-sm font-semibold text-steel-200">
                분배 방식 <span className="text-xs font-normal text-steel-400">(선택, 다시 누르면 해제)</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {DISTRIBUTION_METHODS.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, distributionType: prev.distributionType === type ? "" : type }))
                    }
                    aria-pressed={form.distributionType === type}
                    className={`rounded-md border-[3px] border-black px-3 py-2 text-sm font-bold transition-all duration-100 ${
                      form.distributionType === type
                        ? "translate-y-[3px] bg-plate-yellow text-black shadow-none"
                        : "bg-steel-700 text-steel-200 shadow hover:-translate-y-0.5 hover:shadow-md"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block mb-2 text-sm font-semibold text-steel-200">분배 위치</label>
              <input
                type="text"
                name="distributionLocation"
                value={form.distributionLocation}
                onChange={handleChange}
                className={FIELD}
                placeholder="예: 헬스장 1층 보관함 앞"
              />
            </div>
          </div>

          <div>
            <label className="block mb-2 text-sm font-semibold text-steel-200">추가 설명</label>
            <textarea
              name="detailNote"
              value={form.detailNote}
              onChange={handleChange}
              className={`${FIELD} min-h-[120px]`}
              placeholder="분배 일정, 주의사항 등"
            />
          </div>

          <div className="space-y-3">
            <label htmlFor="protein-image" className="block text-sm font-semibold text-steel-200">
              대표 이미지 <span className="text-xs font-normal text-steel-400">(선택, 목록에 보여요)</span>
            </label>
            <p className="text-xs text-steel-400">제품 사진처럼 누구에게 보여도 괜찮은 사진을 올려 주세요.</p>
            <UploadDropzone
              accept="image/*"
              multiple={false}
              folder="protein"
              onUploaded={(url) => setForm((prev) => ({ ...prev, image: url }))}
            />
            <input
              id="protein-image"
              type="text"
              name="image"
              value={form.image}
              onChange={handleChange}
              className={FIELD}
              placeholder="또는 이미지 주소를 붙여 넣기"
            />
            {form.image && (
              <div className="dg-well dg-pop p-3">
                <p className="text-sm text-steel-300 mb-2">미리보기</p>
                <img src={form.image} alt="대표 이미지 미리보기" className="w-full h-48 object-cover rounded border-2 border-black" />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <label htmlFor="protein-receipt" className="block text-sm font-semibold text-steel-200">
              영수증/실구매 인증 <span className="text-xs font-normal text-steel-400">(선택)</span>
            </label>
            <p className="text-xs text-steel-400">작성자, 운영진, 승인된 참여자에게만 보여요. 목록에는 나오지 않아요.</p>
            <UploadDropzone
              accept="image/*"
              multiple={false}
              folder="protein"
              onUploaded={(url) => setForm((prev) => ({ ...prev, receipt: url }))}
            />
            <input
              id="protein-receipt"
              type="text"
              name="receipt"
              value={form.receipt}
              onChange={handleChange}
              className={FIELD}
              placeholder="또는 이미지 주소를 붙여 넣기"
            />
            {form.receipt && (
              <div className="dg-well dg-pop p-3">
                <p className="text-sm text-steel-300 mb-2">미리보기</p>
                <img src={form.receipt} alt="영수증 미리보기" className="w-full h-48 object-cover rounded border-2 border-black" />
              </div>
            )}
          </div>

          {!canSubmit && form.name.trim() && (
            <p className="text-xs font-semibold text-plate-yellow">지역 또는 헬스장 중 하나는 필수입니다.</p>
          )}
          {err && <p className="dg-pop dg-well border-l-4 border-l-plate-red p-3 text-sm text-red-200">{err}</p>}

          <button
            type="submit"
            disabled={submitting || !canSubmit}
            className="dg-btn dg-btn-primary w-full"
          >
            {submitting ? "등록 중..." : "공동구매 모집글 등록"}
          </button>
        </form>
      </div>
    </section>
  );
}
