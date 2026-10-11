import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { logEvent } from "../utils/analytics";
import { useCountUp } from "../hooks/useCountUp";
import { useInView } from "../hooks/useInView";
import { toast } from "../lib/toast";
import { friendlyError, httpError } from "../lib/httpError";
import { splitReview } from "../utils/reviewContent";

// 서버 ReviewResponse 와 같은 이름을 쓴다(예전엔 userNickname/userEmail 을 읽어 늘 "익명 회원"이었다)
type Review = {
  id: number;
  rating: number;
  content: string;
  userId?: number | null;
  nickname?: string | null;
  proteinId?: number | null;
  proteinName?: string | null;
  createdAt?: string | null;
  mine?: boolean;
};

type PageResponse<T> = {
  content?: T[];
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

type Protein = { id: number; name: string; category?: string; avgRating?: number | null };

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
  if (!res.ok) throw await httpError(res, "요청을 처리하지 못했어요.");
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

const formatDate = (v?: string | null) => {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const parseLocation = (category?: string) => {
  if (!category) return { region: "미정", gym: "미정" };
  const [regionRaw, gymRaw] = category.split("/");
  return {
    region: (regionRaw || "").trim() || "미정",
    gym: (gymRaw || "").trim() || "미정",
  };
};

// 점수 칸: 숫자는 0 에서 굴러 올라가고, 아래 10칸 게이지가 하나씩 켜진다.
function ScoreWell({ label, value, max }: { label: string; value: number; max: number }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const v = useCountUp(value, { duration: 900, start: inView });
  const lit = Math.round((Math.max(0, Math.min(max, value)) / max) * 10);
  return (
    <div ref={ref} className="dg-well p-4">
      <p className="text-xs font-semibold text-steel-400">{label}</p>
      <p className="font-num mt-1 text-4xl font-black text-plate-yellow">
        {v.toFixed(1)}
        <span className="ml-1 text-lg text-steel-400">/ {max}</span>
      </p>
      <div className="mt-2 grid grid-cols-10 gap-[3px]" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={`h-2.5 rounded-[2px] border border-black transition-colors duration-200 ${
              inView && i < lit ? "bg-plate-green" : "bg-steel-800"
            }`}
            style={{ transitionDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function Reviews() {
  const [items, setItems] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proteins, setProteins] = useState<Protein[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();

  // 고른 공동구매는 주소(?proteinId=)에서만 읽는다. 없으면 전체 후기.
  const pidParam = Number(searchParams.get("proteinId"));
  const selectedProtein = Number.isInteger(pidParam) && pidParam > 0 ? pidParam : null;

  const userRaw = localStorage.getItem("user");
  const user = useMemo(() => {
    try {
      return userRaw ? (JSON.parse(userRaw) as { email?: string; role?: string }) : null;
    } catch {
      return null;
    }
  }, [userRaw]);
  const isAdmin = (user?.role || "").toUpperCase().includes("ADMIN");
  // 내 후기인지는 서버가 알려 준다(mine). 이메일을 응답에 싣지 않기 위해서.
  const canEdit = (rev: Review) => !!user && (!!rev.mine || isAdmin);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const query = selectedProtein ? `&proteinId=${selectedProtein}` : "";
        const data = await api<PageResponse<Review>>(`/api/reviews?size=50${query}`);
        if (cancelled) return;
        setItems(Array.isArray(data) ? data : data?.content ?? []);
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, "후기를 불러오지 못했어요."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedProtein]);

  useEffect(() => {
    const loadProteins = async () => {
      try {
        const data = await api<PageResponse<Protein>>("/api/proteins?size=50");
        setProteins(Array.isArray(data) ? data : data?.content ?? []);
      } catch {
        // 고르기 목록이 없어도 전체 후기는 볼 수 있다
      }
    };
    void loadProteins();
  }, []);

  useEffect(() => {
    logEvent("reviews", "page_view");
  }, []);

  const navigate = useNavigate();

  const selectProtein = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("proteinId", value);
    else next.delete("proteinId");
    setSearchParams(next, { replace: true });
  };

  // 실제로 있는 값만: 평균 만족도와 후기 수
  const summary = useMemo(() => {
    if (!items.length) return { avg: 0, count: 0 };
    const avg = items.reduce((sum, r) => sum + r.rating, 0) / items.length;
    return { avg, count: items.length };
  }, [items]);

  const selectedInfo = proteins.find((p) => p.id === selectedProtein);
  const { region, gym } = parseLocation(selectedInfo?.category);

  return (
    <section className="min-h-screen px-5 pb-16 pt-24 text-white lg:px-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="dg-steel grid gap-5 p-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-3">
            <p className="font-num text-sm font-bold text-plate-yellow">REVIEW</p>
            <h2 className="font-display text-3xl md:text-5xl">공동구매 후기</h2>
            <p className="max-w-2xl text-sm text-steel-300">
              공동구매에 참여한 회원이 남긴 제품 후기와 공동구매 경험을 모아 봅니다.
              다음 공동구매에 참여하기 전에 참고해 보세요.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to={selectedProtein ? `/reviews/write?proteinId=${selectedProtein}` : "/reviews/write"}
                className="dg-btn dg-btn-primary px-5"
              >
                후기 작성하기
              </Link>
              {selectedProtein && (
                <Link to={`/proteins/${selectedProtein}`} className="dg-btn dg-btn-steel px-5 text-sm">
                  모집글 보기
                </Link>
              )}
            </div>
          </div>

          <div className="dg-whiteboard p-5">
            <div className="font-pen text-3xl leading-none">이 후기로 보는 것</div>
            <div className="mt-3 grid gap-2 md:grid-cols-3 lg:grid-cols-1">
              {["제품 만족도", "공동구매 진행 경험", "다음 참여 전 참고할 점"].map((item, idx) => (
                <div key={item} className="flex items-center gap-2 text-sm font-semibold">
                  <span className="font-num grid h-6 w-6 flex-none place-items-center rounded-full border-2 border-board-ink text-xs font-black">
                    {idx + 1}
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </header>

        <div className="dg-well p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label htmlFor="review-protein" className="font-semibold text-steel-300">
                공동구매 선택
              </label>
              <select
                id="review-protein"
                className="max-w-full rounded border-2 border-black bg-steel-800 px-3 py-2 font-semibold text-white transition-colors hover:bg-steel-700 focus:border-plate-yellow"
                value={selectedProtein ?? ""}
                onChange={(e) => selectProtein(e.target.value)}
              >
                <option value="" className="bg-steel-900">
                  전체 공동구매
                </option>
                {selectedProtein && !selectedInfo && (
                  <option value={selectedProtein} className="bg-steel-900">
                    선택한 공동구매
                  </option>
                )}
                {proteins.map((p) => (
                  <option key={p.id} value={p.id} className="bg-steel-900">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            {selectedInfo && (
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="dg-chip bg-plate-green text-white">{region}</span>
                <span className="dg-chip bg-plate-yellow text-black">{gym}</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="dg-steel p-6">
            <h3 className="font-display text-xl">한눈에 보기</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <ScoreWell label="평균 만족도" value={summary.avg} max={5} />
              <div className="dg-well p-4">
                <p className="text-xs font-semibold text-steel-400">후기 수</p>
                <p className="font-num mt-1 text-4xl font-black text-white">
                  {summary.count}
                  <span className="ml-1 text-lg text-steel-400">개</span>
                </p>
                <p className="mt-2 text-xs text-steel-400">
                  {selectedProtein ? "이 공동구매에 달린 후기" : "모든 공동구매 후기(최근 50개)"}
                </p>
              </div>
            </div>
          </div>

          <div className="dg-steel p-6">
            <h3 className="font-display text-xl">초보자 판단 기준</h3>
            <div className="mt-4 space-y-3 text-sm text-steel-200">
              <div className="dg-well border-l-[6px] border-l-plate-green p-4">
                평점만 보지 말고 후기가 몇 개인지도 함께 확인하세요.
              </div>
              <div className="dg-well border-l-[6px] border-l-plate-yellow p-4">
                후기에서 분배 시간, 약속 장소, 응답 속도를 먼저 확인하세요.
              </div>
              <div className="dg-well border-l-[6px] border-l-plate-blue p-4">
                대표 구매자와 다시 거래하겠다는 의견이 많으면 안정적입니다.
              </div>
            </div>
          </div>
        </div>

        {loading && (
          <p className="flex items-center gap-3 text-steel-300">
            <span className="dg-loading-plates" aria-label="불러오는 중">
              <i />
              <i />
              <i />
              <i />
            </span>
            후기를 불러오는 중입니다...
          </p>
        )}
        {error && <p className="dg-well border-l-4 border-l-plate-red p-3 text-red-200">{error}</p>}
        {!loading && !error && items.length === 0 && (
          <div className="dg-well p-8 text-center text-steel-400">
            아직 등록된 후기가 없습니다.
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {items.map((r, idx) => {
            const { product, share } = splitReview(r.content ?? "");
            return (
              <article
                key={r.id}
                className="dg-steel dg-lift dg-rise p-6"
                style={{ animationDelay: `${Math.min(idx, 10) * 50}ms` }}
              >
                <div className="flex items-center justify-between text-sm text-steel-300">
                  <span className="font-semibold text-white">{r.nickname || "회원"}</span>
                  <span className="font-num text-steel-400">{formatDate(r.createdAt)}</span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="dg-chip bg-plate-yellow text-black">만족도 {r.rating}/5</span>
                  {r.mine && <span className="dg-chip bg-steel-700 text-chalk">내 후기</span>}
                </div>

                <div className="mt-4 grid gap-4 text-sm text-steel-200">
                  {share ? (
                    <>
                      <div className="dg-well p-4">
                        <p className="text-xs font-semibold text-steel-400">제품 후기</p>
                        <p className="mt-2 whitespace-pre-wrap">{product}</p>
                      </div>
                      <div className="dg-well p-4">
                        <p className="text-xs font-semibold text-steel-400">공동구매 경험</p>
                        <p className="mt-2 whitespace-pre-wrap">{share}</p>
                      </div>
                    </>
                  ) : (
                    <div className="dg-well p-4">
                      <p className="text-xs font-semibold text-steel-400">후기</p>
                      <p className="mt-2 whitespace-pre-wrap">{product}</p>
                    </div>
                  )}
                </div>

                {r.proteinName && !selectedProtein && (
                  <p className="mt-4 text-xs text-steel-400">
                    공동구매:{" "}
                    <button
                      type="button"
                      className="font-semibold text-steel-200 underline-offset-2 hover:underline"
                      onClick={() => r.proteinId && selectProtein(String(r.proteinId))}
                    >
                      {r.proteinName}
                    </button>
                  </p>
                )}

                {canEdit(r) && (
                  <div className="mt-4 flex gap-2 text-xs">
                    <button
                      className="dg-btn dg-btn-steel min-h-[36px] px-3 text-xs"
                      onClick={() =>
                        navigate(r.proteinId ? `/reviews/write?proteinId=${r.proteinId}` : "/reviews/write", {
                          state: { review: { id: r.id, rating: r.rating, content: r.content, proteinId: r.proteinId } },
                        })
                      }
                    >
                      수정
                    </button>
                    <button
                      className="dg-btn min-h-[36px] bg-steel-900 px-3 text-xs text-red-300 hover:bg-plate-red hover:text-white"
                      onClick={async () => {
                        if (!confirm("후기를 삭제할까요?")) return;
                        try {
                          await api(`/api/reviews/${r.id}`, { method: "DELETE" });
                          setItems((prev) => prev.filter((x) => x.id !== r.id));
                          toast("후기를 삭제했어요.", "success");
                        } catch (e) {
                          toast(friendlyError(e, "후기를 삭제하지 못했어요."), "error");
                        }
                      }}
                    >
                      삭제
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
