import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { logEvent } from "../utils/analytics";

type ReviewPayload = {
  rating: number;
  content: string;
  proteinId: number;
};

type ReviewEditState = {
  id?: number;
  rating?: number;
  content?: string;
  proteinId?: number;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
// 글쓰기 입력칸: 철판 안쪽의 어두운 칸 + 포커스 시 노란 외곽선
const FIELD =
  "dg-well w-full p-3 text-white placeholder:text-steel-500 transition-colors focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow";
type Protein = { id: number; name: string };

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
    alert("로그인이 필요합니다.");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export default function WriteReview() {
  const navigate = useNavigate();
  const location = useLocation();
  const editing = (location.state as { review?: ReviewEditState })?.review;

  const [form, setForm] = useState({
    rating: editing?.rating ?? 5,
    content: editing?.content ?? "",
    proteinId: editing?.proteinId ?? 1,
  });
  const [proteins, setProteins] = useState<Protein[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const hasProtein = proteins.length > 0;

  useEffect(() => {
    if (editing) {
      setForm({
        rating: editing.rating ?? 5,
        content: editing.content ?? "",
        proteinId: editing.proteinId ?? 1,
      });
    }
  }, [editing]);

  useEffect(() => {
    const loadProteins = async () => {
      try {
        const data = await api<{ content?: any[]; [k: string]: any }>("/api/proteins");
        const listRaw = Array.isArray(data) ? data : data.content ?? [];
        const normalized: Protein[] = listRaw
          .map((p: any) => ({
            id: p.id ?? p.proteinId ?? p.protein_id ?? 0,
            name: p.name ?? p.title ?? "제품",
          }))
          .filter((p) => p.id);
        setProteins(normalized);
        if (!editing && normalized.length > 0) {
          setForm((prev) => ({ ...prev, proteinId: normalized[0].id }));
        }
      } catch {
        // ignore fetch failure
      }
    };
    loadProteins();
    logEvent("write_review", editing ? "page_view_edit" : "page_view_create");
  }, [editing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasProtein) {
      setErr("제품 목록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
      return;
    }
    if (!form.content.trim()) {
      setErr("내용을 입력해주세요.");
      return;
    }
    try {
      setSubmitting(true);
      setErr(null);
      const payload: ReviewPayload = {
        rating: form.rating,
        content: form.content.trim(),
        proteinId: form.proteinId,
      };
      if (editing?.id) {
        await api(`/api/reviews/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        alert("리뷰가 수정되었습니다.");
      } else {
        await api("/api/reviews", { method: "POST", body: JSON.stringify(payload) });
        alert("리뷰가 등록되었습니다.");
      }
      navigate("/reviews");
    } catch (e: any) {
      setErr(e?.message || "요청에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="pt-32 px-5 pb-12 sm:px-12 min-h-screen text-white">
      <div className="dg-steel dg-rise max-w-2xl mx-auto p-8">
        <h2 className="font-display text-3xl mb-8 text-center">{editing ? "리뷰 수정" : "리뷰 작성"}</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block mb-2 font-semibold text-steel-200">별점</label>
            <div className="mb-2 flex items-end gap-1.5" aria-hidden>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  tabIndex={-1}
                  onClick={() => setForm({ ...form, rating: n })}
                  className={`w-4 rounded-sm border-2 border-black transition-all duration-150 hover:-translate-y-0.5 ${
                    n <= form.rating ? "bg-plate-red shadow-sm" : "bg-steel-700"
                  }`}
                  style={{ height: 22 + n * 5 }}
                />
              ))}
              <span key={form.rating} className="dg-pop font-num ml-2 text-3xl font-black leading-none text-plate-yellow">
                {form.rating}
              </span>
            </div>
            <input
              type="number"
              name="stars"
              value={form.rating}
              onChange={(e) => setForm({ ...form, rating: Math.min(5, Math.max(1, Number(e.target.value))) })}
              min={1}
              max={5}
              className={FIELD}
            />
          </div>

          <div>
            <label className="block mb-2 font-semibold text-steel-200">내용</label>
            <textarea
              name="text"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className={`${FIELD} h-32`}
              required
            />
          </div>

          <div>
            <label className="block mb-2 font-semibold text-steel-200">제품 선택</label>
            <select
              className={FIELD}
              value={form.proteinId}
              onChange={(e) => setForm({ ...form, proteinId: Number(e.target.value) })}
              disabled={!hasProtein}
            >
              {proteins.map((p) => (
                <option key={p.id} value={p.id} className="bg-steel-900">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {err && <p className="dg-pop dg-well border-l-4 border-l-plate-red p-3 text-sm text-red-200">{err}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate("/reviews")}
              className="dg-btn dg-btn-steel px-4 text-sm"
            >
              목록으로
            </button>
            <button
              type="submit"
              className="dg-btn dg-btn-primary flex-1"
              disabled={submitting}
            >
              {submitting ? "저장 중.." : editing ? "수정하기" : "등록하기"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
