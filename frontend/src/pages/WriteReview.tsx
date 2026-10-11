import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { logEvent } from "../utils/analytics";
import { toast } from "../lib/toast";
import { friendlyError, httpError } from "../lib/httpError";
import { joinReview, REVIEW_MAX_LENGTH, splitReview } from "../utils/reviewContent";

type ReviewPayload = {
  rating: number;
  content: string;
  proteinId: number;
};

type ReviewEditState = {
  id?: number;
  rating?: number;
  content?: string;
  proteinId?: number | null;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
// 글쓰기 입력칸: 철판 안쪽의 어두운 칸 + 포커스 시 노란 외곽선
const FIELD =
  "dg-well w-full p-3 text-white placeholder:text-steel-500 transition-colors focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow";
type Protein = { id: number; name: string };
type ProteinRaw = { id?: number; name?: string };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const url = API_BASE ? `${API_BASE}${path}` : path;

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    credentials: "include",
    ...init,
  });

  if (res.status === 401) {
    toast("로그인이 필요해요.", "error");
    window.location.href = "/login";
    throw await httpError(res, "로그인이 필요해요.");
  }
  if (!res.ok) throw await httpError(res, "후기를 저장하지 못했어요.");
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

const RATING_LABELS = ["", "별로예요", "아쉬워요", "보통이에요", "좋아요", "아주 좋아요"];

export default function WriteReview() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const editing = (location.state as { review?: ReviewEditState } | null)?.review;

  // 제품은 수정할 땐 원래 후기의 것, 새로 쓸 땐 주소(?proteinId=)에서. 아무 값도 없으면 직접 고른다.
  const pidFromUrl = Number(searchParams.get("proteinId"));
  const initialProteinId =
    editing?.proteinId ?? (Number.isInteger(pidFromUrl) && pidFromUrl > 0 ? pidFromUrl : null);
  const initialParts = splitReview(editing?.content ?? "");

  const [form, setForm] = useState({
    rating: editing?.rating ?? 5,
    product: initialParts.product,
    share: initialParts.share,
    proteinId: initialProteinId as number | null,
  });
  const [proteins, setProteins] = useState<Protein[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!editing?.id;

  useEffect(() => {
    const loadProteins = async () => {
      try {
        const data = await api<{ content?: ProteinRaw[] } | ProteinRaw[]>("/api/proteins?size=50");
        const listRaw = Array.isArray(data) ? data : data?.content ?? [];
        const normalized: Protein[] = listRaw
          .map((p) => ({ id: p.id ?? 0, name: p.name ?? "제품" }))
          .filter((p) => p.id);
        setProteins(normalized);
      } catch {
        // 목록을 못 불러와도 주소로 받은 제품이면 그대로 쓸 수 있다
      }
    };
    void loadProteins();
    logEvent("write_review", isEdit ? "page_view_edit" : "page_view_create");
  }, [isEdit]);

  const content = joinReview(form.product, form.share);
  const tooLong = content.length > REVIEW_MAX_LENGTH;
  const selectedName = proteins.find((p) => p.id === form.proteinId)?.name;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.proteinId) {
      setErr("후기를 남길 공동구매를 골라 주세요.");
      return;
    }
    if (!form.product.trim()) {
      setErr("제품 후기를 적어 주세요.");
      return;
    }
    if (tooLong) {
      setErr(`두 칸을 합쳐 ${REVIEW_MAX_LENGTH}자까지 쓸 수 있어요.`);
      return;
    }
    try {
      setSubmitting(true);
      setErr(null);
      const payload: ReviewPayload = {
        rating: form.rating,
        content,
        proteinId: form.proteinId,
      };
      if (isEdit) {
        // 수정은 별점 · 본문만 바뀐다(서버도 제품은 바꾸지 않는다)
        await api(`/api/reviews/${editing?.id}`, {
          method: "PATCH",
          body: JSON.stringify({ rating: payload.rating, content: payload.content }),
        });
        toast("후기를 수정했어요.", "success");
      } else {
        await api("/api/reviews", { method: "POST", body: JSON.stringify(payload) });
        toast("후기를 등록했어요.", "success");
      }
      navigate(`/reviews?proteinId=${form.proteinId}`);
    } catch (e) {
      setErr(friendlyError(e, "후기를 저장하지 못했어요."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="pt-32 px-5 pb-12 sm:px-12 min-h-screen text-white">
      <div className="dg-steel dg-rise max-w-2xl mx-auto p-6 sm:p-8">
        <h2 className="font-display text-3xl mb-8 text-center">{isEdit ? "후기 수정" : "후기 작성"}</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="review-protein" className="block mb-2 font-semibold text-steel-200">
              공동구매
            </label>
            <select
              id="review-protein"
              className={FIELD}
              value={form.proteinId ?? ""}
              onChange={(e) => setForm({ ...form, proteinId: e.target.value ? Number(e.target.value) : null })}
              disabled={isEdit}
              aria-describedby={isEdit ? "review-protein-lock" : undefined}
            >
              <option value="" className="bg-steel-900">
                공동구매를 골라 주세요
              </option>
              {form.proteinId && !selectedName && (
                <option value={form.proteinId} className="bg-steel-900">
                  선택한 공동구매
                </option>
              )}
              {proteins.map((p) => (
                <option key={p.id} value={p.id} className="bg-steel-900">
                  {p.name}
                </option>
              ))}
            </select>
            {isEdit && (
              <p id="review-protein-lock" className="mt-2 text-xs text-steel-400">
                후기를 쓴 공동구매는 바꿀 수 없어요.
              </p>
            )}
          </div>

          <fieldset>
            <legend className="mb-2 font-semibold text-steel-200">별점</legend>
            <div className="flex items-end gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="cursor-pointer">
                  <input
                    type="radio"
                    name="rating"
                    value={n}
                    checked={form.rating === n}
                    onChange={() => setForm({ ...form, rating: n })}
                    className="peer sr-only"
                    aria-label={`${n}점 · ${RATING_LABELS[n]}`}
                  />
                  <span
                    aria-hidden
                    className={`block w-6 rounded-sm border-2 border-black transition-all duration-150 hover:-translate-y-0.5 peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-plate-yellow ${
                      n <= form.rating ? "bg-plate-red shadow-sm" : "bg-steel-700"
                    }`}
                    style={{ height: 22 + n * 5 }}
                  />
                </label>
              ))}
              <span key={form.rating} className="dg-pop font-num ml-2 text-3xl font-black leading-none text-plate-yellow" aria-hidden>
                {form.rating}
              </span>
              <span className="ml-1 text-sm font-semibold text-steel-300">{RATING_LABELS[form.rating]}</span>
            </div>
          </fieldset>

          <div>
            <label htmlFor="review-product" className="block mb-2 font-semibold text-steel-200">
              제품 후기
            </label>
            <textarea
              id="review-product"
              value={form.product}
              onChange={(e) => setForm({ ...form, product: e.target.value })}
              className={`${FIELD} h-28`}
              placeholder="맛, 용해도, 포만감처럼 제품 자체에 대한 느낌"
              required
            />
          </div>

          <div>
            <label htmlFor="review-share" className="block mb-2 font-semibold text-steel-200">
              공동구매 경험 <span className="text-xs font-normal text-steel-400">(선택)</span>
            </label>
            <textarea
              id="review-share"
              value={form.share}
              onChange={(e) => setForm({ ...form, share: e.target.value })}
              className={`${FIELD} h-28`}
              placeholder="분배 시간 · 장소, 대표 구매자 응답 속도 등"
            />
            <p className={`mt-1 text-right font-num text-xs ${tooLong ? "text-red-300" : "text-steel-400"}`}>
              {content.length} / {REVIEW_MAX_LENGTH}
            </p>
          </div>

          {err && <p className="dg-pop dg-well border-l-4 border-l-plate-red p-3 text-sm text-red-200">{err}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate(form.proteinId ? `/reviews?proteinId=${form.proteinId}` : "/reviews")}
              className="dg-btn dg-btn-steel px-4 text-sm"
            >
              목록으로
            </button>
            <button
              type="submit"
              className="dg-btn dg-btn-primary flex-1"
              disabled={submitting}
            >
              {submitting ? "저장 중.." : isEdit ? "수정하기" : "등록하기"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
