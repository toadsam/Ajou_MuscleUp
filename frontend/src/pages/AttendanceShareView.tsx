import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import PhotoShareEditor from "../components/share/PhotoShareEditor";
import { dotDate, shareFileName, type PhotoCardContent } from "../lib/photoCard";
import { toast } from "../lib/toast";
import { friendlyError, httpError } from "../lib/httpError";

// 출석 공유 화면(/attendance/share/:slug, 로그인 없이도 열림).
// 공유 카드는 러닝 공유와 같은 사진 카드(lib/photoCard.ts): 사진 + 왼쪽 위 워터마크 하나 + 고른 숫자(연속 출석 · 운동 · 날짜 · 한마디).
// 예전의 테마 · 스티커 · 캐릭터 · 장식 · html2canvas 캡처는 사용자 요청으로 뺐다(2026-10-16, docs/fix-log.md).
// 출석 화면에서 ?auto=share 로 오면 공유 버튼을 눈에 띄게, ?auto=save 면 준비되는 대로 한 번 저장한다.

// 공개 공유 응답. 백엔드가 공개 응답에서 memo·reportCount·hiddenByAdmin·id 를 뺄 수 있어 모두 선택 값으로 둔다.
// (이름이 DOM 의 Web Share ShareData 와 겹친다 — Web Share 쪽은 PhotoShareEditor 안의 별도 타입)
type ShareData = {
  id?: number;
  date: string;
  didWorkout: boolean;
  memo?: string | null;
  shareComment?: string | null;
  workoutTypes?: string[] | null;
  workoutIntensity?: string | null;
  mediaUrls?: string[] | null;
  authorNickname?: string | null;
  cheerCount?: number | null;
  reportCount?: number | null;
  hiddenByAdmin?: boolean | null;
  currentStreak?: number | null;
  lastEditedAt?: string | null;
  updatedAt?: string | null;
  shareSlug: string;
};

type ReactionStore = Record<string, { cheer?: boolean; report?: boolean }>;

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const REACTION_KEY = "attendance_share_reaction_v1";
const TYPE_LABEL: Record<string, string> = { weight: "웨이트", cardio: "유산소", stretch: "스트레칭" };
const INTENSITY_LABEL: Record<string, string> = { light: "가벼움", normal: "보통", hard: "강함" };

const withBase = (url: string) => (url?.startsWith("http") ? url : `${API_BASE}${url}`);
const withProxy = (url: string) => `${API_BASE}/api/files/proxy?path=${encodeURIComponent(url)}`;
const isVideo = (url: string) => /\.(mp4|mov|webm|avi|mkv|m4v)(\?|$)/i.test(url.split("?")[0]);

function loadReactionStore(): ReactionStore {
  try {
    return JSON.parse(localStorage.getItem(REACTION_KEY) || "{}") as ReactionStore;
  } catch {
    return {};
  }
}

export default function AttendanceShareView() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const auto = searchParams.get("auto");
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [photoState, setPhotoState] = useState<"none" | "loading" | "ready" | "failed">("none");
  const [sending, setSending] = useState(false);
  const [reactions, setReactions] = useState<ReactionStore>(() => loadReactionStore());

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE}/api/attendance/share/${slug}`);
        if (!res.ok) throw await httpError(res, "공유된 출석을 불러오지 못했어요.");
        setData((await res.json()) as ShareData);
      } catch (e: unknown) {
        setError(friendlyError(e, "공유된 출석을 불러오지 못했어요."));
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  // 출석 사진(첫 이미지)을 받아 카드 바탕에 깐다. 다른 주소 사진은 캔버스를 막으므로 내려받아 이 페이지 주소(blob:)로 쓴다.
  const firstImage = useMemo(() => {
    const image = data?.mediaUrls?.find((raw) => !isVideo(withBase(raw)));
    return image ? withProxy(withBase(image)) : null;
  }, [data]);

  useEffect(() => {
    if (!firstImage) {
      setPhotoState("none");
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    setPhotoState("loading");
    (async () => {
      try {
        const res = await fetch(firstImage, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        objectUrl = URL.createObjectURL(await res.blob());
        const img = new Image();
        img.onload = () => {
          if (cancelled) return;
          setPhoto(img);
          setPhotoState("ready");
        };
        img.onerror = () => !cancelled && setPhotoState("failed");
        img.src = objectUrl;
      } catch {
        if (!cancelled) setPhotoState("failed");
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [firstImage]);

  const quoteText = (data?.shareComment || data?.memo || "").trim();
  // build 가 바뀌면 카드를 다시 그리므로, 렌더마다 새 배열을 만들지 않게 묶어 둔다
  const types = useMemo(() => (data?.workoutTypes ?? []).map((t) => TYPE_LABEL[t] ?? t), [data?.workoutTypes]);
  const toggles = useMemo(
    () => [
      { key: "streak", label: "연속 출석" },
      { key: "workout", label: "운동", disabled: types.length === 0 },
      { key: "date", label: "날짜" },
      { key: "quote", label: "한마디", disabled: !quoteText },
    ],
    [types.length, quoteText],
  );

  const build = useCallback(
    (show: Record<string, boolean>): PhotoCardContent => {
      if (!data) return {};
      const stats: { value: string; label: string }[] = [];
      if (show.workout && types.length) {
        stats.push({ value: types.join(" · "), label: "오늘 운동" });
        const intensity = data.workoutIntensity ? INTENSITY_LABEL[data.workoutIntensity] : null;
        if (intensity && types.length < 3) stats.push({ value: intensity, label: "강도" });
      }
      return {
        kicker: show.date ? `${dotDate(data.date)} ${data.didWorkout ? "출석" : "휴식"}` : null,
        quote: show.quote && quoteText ? quoteText : null,
        headline: show.streak ? { value: String(data.currentStreak ?? 0), label: "일 연속 출석" } : null,
        stats,
      };
    },
    [data, types, quoteText],
  );

  const appShareLink = data ? `${window.location.origin}/attendance/share/${data.shareSlug}` : "";
  const publicShareLink = data ? `${API_BASE || window.location.origin}/share/attendance/${data.shareSlug}` : "";
  const name = data?.authorNickname?.trim() || "회원";
  const shareText = data ? `${name}님의 오늘 출석 · 연속 ${data.currentStreak ?? 0}일 — 득근득근` : "";

  const hasReacted = (kind: "cheer" | "report") => Boolean(slug && reactions[slug]?.[kind]);

  const sendReaction = async (kind: "cheer" | "report") => {
    if (!data || sending || !slug) return;
    if (hasReacted(kind)) {
      toast(kind === "cheer" ? "이미 응원했어요." : "이미 신고했어요.");
      return;
    }
    try {
      setSending(true);
      // 신고는 로그인이 필요하다(서버가 쿠키로 사용자를 확인). 응원도 같은 방식으로 쿠키를 보낸다.
      const res = await fetch(`${API_BASE}/api/attendance/share/${data.shareSlug}/${kind}`, { method: "POST", credentials: "include" });
      if (res.status === 401) {
        toast(kind === "report" ? "로그인하면 신고할 수 있어요." : "로그인하면 응원할 수 있어요.", "error");
        return;
      }
      if (!res.ok) throw await httpError(res, kind === "cheer" ? "응원을 보내지 못했어요." : "신고를 접수하지 못했어요.");
      const payload: ShareData = await res.json();
      // 공개 응답에서 빠질 수 있는 값(memo·reportCount 등)은 기존 값을 지우지 않게 합친다
      setData((prev) => (prev ? { ...prev, ...payload } : payload));
      const next = { ...reactions, [slug]: { ...(reactions[slug] || {}), [kind]: true } };
      setReactions(next);
      try {
        localStorage.setItem(REACTION_KEY, JSON.stringify(next));
      } catch {
        // 저장 못 해도 이번 화면에서는 반영됨
      }
      toast(kind === "report" ? "신고가 접수됐어요. 운영진이 확인할게요." : "응원을 보냈어요.", "success");
    } catch (e: unknown) {
      toast(friendlyError(e, "처리하지 못했어요. 다시 시도해 주세요."), "error");
    } finally {
      setSending(false);
    }
  };

  if (loading || error || !data) {
    return (
      <section className="min-h-screen px-4 pb-28 pt-28 text-white">
        <div className="mx-auto max-w-md text-center text-sm text-steel-300" role="status">
          {loading ? (
            <span className="inline-flex items-center gap-3">
              <span className="dg-loading-plates" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              불러오는 중
            </span>
          ) : (
            <div className="dg-steel p-5">{error || "공유 페이지를 찾을 수 없어요."}</div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen px-4 pb-28 pt-28 text-white md:px-10">
      <div className="mx-auto max-w-md space-y-5">
        <header className="space-y-1">
          <p className="text-sm font-bold text-plate-yellow">출석 공유</p>
          <h1 className="text-3xl">{name}님의 출석</h1>
          <p className="text-sm text-steel-400">
            {data.date} · {data.didWorkout ? "운동 완료" : "휴식 기록"} · 연속 {data.currentStreak ?? 0}일
          </p>
        </header>

        {photoState === "loading" && <p className="text-xs text-steel-400">출석 사진을 불러오는 중이에요…</p>}
        {photoState === "failed" && <p className="text-xs text-steel-400">출석 사진을 불러오지 못했어요. 앨범에서 골라 주세요.</p>}

        <PhotoShareEditor
          layout="inline"
          toggles={toggles}
          initialShow={{ streak: true, workout: types.length > 0, date: true, quote: false }}
          build={build}
          initialPhoto={photo}
          fileName={shareFileName("attendance", data.date)}
          shareTitle="득근득근 출석"
          fallbackLink={{ text: shareText, url: publicShareLink }}
          autoSave={auto === "save"}
          highlightShare={auto === "share"}
        />

        {/* 메모는 공개 응답에서 빠질 수 있다. 없으면 칸 자체를 숨긴다 */}
        {data.memo?.trim() && (
          <div className="dg-whiteboard p-4">
            <p className="font-pen text-2xl">오늘의 메모</p>
            <p className="whitespace-pre-line text-sm">{data.memo}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={sending || hasReacted("cheer")} onClick={() => void sendReaction("cheer")} className="dg-btn dg-btn-steel min-h-[44px]">
            응원하기 {data.cheerCount ?? 0}
          </button>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(`${shareText} ${publicShareLink}`)
                .then(() => toast("링크를 복사했어요.", "success"))
                .catch(() => toast("복사하지 못했어요.", "error"));
            }}
            className="dg-btn dg-btn-steel min-h-[44px]"
          >
            링크 복사
          </button>
          <Link to="/" className="dg-btn dg-btn-steel min-h-[44px]">
            홈으로
          </Link>
          <button type="button" disabled={sending || hasReacted("report")} onClick={() => void sendReaction("report")} className="dg-btn dg-btn-steel min-h-[44px] text-steel-300">
            신고하기
          </button>
        </div>
        <p className="text-center text-xs text-steel-500">
          <a href={appShareLink} className="underline underline-offset-4">
            이 페이지 주소
          </a>
        </p>
      </div>
    </section>
  );
}
