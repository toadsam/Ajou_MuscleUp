import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  renderAttendanceShareCard,
  type ShareCardQuoteStyle,
  type ShareCardRatio,
  type ShareCardTheme,
} from "../utils/attendanceShareCard";
import "../styles/attendanceShare.css";

type ShareData = {
  id: number;
  date: string;
  didWorkout: boolean;
  memo?: string | null;
  shareComment?: string | null;
  workoutTypes?: string[] | null;
  workoutIntensity?: string | null;
  mediaUrls?: string[] | null;
  authorNickname?: string | null;
  cheerCount: number;
  reportCount: number;
  lastEditedAt?: string | null;
  updatedAt?: string | null;
  shareSlug: string;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const withBase = (url: string) => (url?.startsWith("http") ? url : `${API_BASE}${url}`);
const isVideo = (url: string) => /\.(mp4|mov|webm|avi|mkv|m4v)(\?|$)/i.test(url.split("?")[0]);

const THEME_OPTIONS: Array<{ id: ShareCardTheme; label: string }> = [
  { id: "sunset", label: "Sunset" },
  { id: "mint", label: "Mint" },
  { id: "midnight", label: "Midnight" },
];

const RATIO_OPTIONS: Array<{ id: ShareCardRatio; label: string }> = [
  { id: "feed", label: "Feed 4:5" },
  { id: "square", label: "Square" },
  { id: "story", label: "Story 9:16" },
];

const QUOTE_OPTIONS: Array<{ id: ShareCardQuoteStyle; label: string }> = [
  { id: "glass", label: "Glass" },
  { id: "outline", label: "Outline" },
  { id: "solid", label: "Solid" },
];

const STICKERS = ["", "🔥", "💪", "✨", "🚀", "🏆"];

export default function AttendanceShareView() {
  const { slug } = useParams();
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const [theme, setTheme] = useState<ShareCardTheme>("sunset");
  const [ratio, setRatio] = useState<ShareCardRatio>("feed");
  const [quoteStyle, setQuoteStyle] = useState<ShareCardQuoteStyle>("glass");
  const [sticker, setSticker] = useState<string>("🔥");
  const [showMeta, setShowMeta] = useState(true);
  const [customMessage, setCustomMessage] = useState("");

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE}/api/attendance/share/${slug}`);
        if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
        const payload: ShareData = await res.json();
        setData(payload);
      } catch (e: any) {
        setError(e?.message || "공유된 출석을 불러오지 못했어요.");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  useEffect(() => {
    if (!data) return;
    const seed = data.shareComment?.trim() || data.memo?.trim() || "오늘 출석 완료!";
    setCustomMessage(seed);
  }, [data?.shareSlug]);

  const title = useMemo(() => {
    if (!data) return "출석 자랑";
    const name = data.authorNickname?.trim() || "회원";
    return `${name}님의 출석 자랑`;
  }, [data]);

  const shareOrigin = API_BASE || window.location.origin;
  const shareLink = data ? `${shareOrigin}/share/attendance/${data.shareSlug}` : "";

  const firstImage = useMemo(() => {
    if (!data?.mediaUrls?.length) return null;
    const image = data.mediaUrls.find((raw) => !isVideo(withBase(raw)));
    return image ? withBase(image) : null;
  }, [data]);

  const composeShareText = () => {
    const message = customMessage.trim() || data?.memo?.trim() || "오늘 출석 완료!";
    return `${message}\n${shareLink}`;
  };

  const quickShare = async () => {
    if (!shareLink) return;
    const text = composeShareText();
    try {
      if (navigator.share) {
        await navigator.share({ title: "출석 자랑", text, url: shareLink });
      } else {
        await navigator.clipboard.writeText(text);
        alert("멘트와 링크를 복사했어요.");
      }
    } catch {
      // User canceled share sheet.
    }
  };

  const kakaoShare = () => {
    if (!shareLink) return;
    const storyUrl = `https://story.kakao.com/share?url=${encodeURIComponent(shareLink)}`;
    window.open(storyUrl, "_blank", "noopener,noreferrer");
  };

  const saveImage = async () => {
    if (!data) return;
    try {
      const blob = await renderAttendanceShareCard({
        date: data.date,
        didWorkout: data.didWorkout,
        workoutTypes: data.workoutTypes ?? [],
        workoutIntensity: data.workoutIntensity ?? null,
        memo: data.memo ?? null,
        shareComment: customMessage || data.shareComment || null,
        mediaUrl: firstImage,
        nickname: data.authorNickname ?? null,
        theme,
        ratio,
        quoteStyle,
        sticker,
        showMeta,
        cheerCount: data.cheerCount,
      });
      const fileUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = fileUrl;
      a.download = `attendance-card-${data.date}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(fileUrl);
    } catch (e: any) {
      alert(e?.message || "이미지 저장에 실패했어요.");
    }
  };

  const sendReaction = async (kind: "cheer" | "report") => {
    if (!data || sending) return;
    try {
      setSending(true);
      const res = await fetch(`${API_BASE}/api/attendance/share/${data.shareSlug}/${kind}`, { method: "POST" });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const payload: ShareData = await res.json();
      setData(payload);
      if (kind === "report") alert("신고가 접수됐어요.");
    } catch (e: any) {
      alert(e?.message || "처리에 실패했어요.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <section className="attendance-share-page theme-sunset">
        <div className="share-shell">불러오는 중...</div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="attendance-share-page theme-sunset">
        <div className="share-shell text-red-200">{error || "공유 페이지를 찾을 수 없습니다."}</div>
      </section>
    );
  }

  return (
    <section className={`attendance-share-page theme-${theme}`}>
      <div className="share-orb one" />
      <div className="share-orb two" />

      <div className="share-shell">
        <div className="mb-4">
          <p className="text-xs tracking-[0.25em] uppercase text-white/70">Attendance Brag Studio</p>
          <h1 className="text-3xl md:text-4xl font-extrabold mt-2">{title}</h1>
          <p className="text-sm text-white/80 mt-1">{data.date} · {data.didWorkout ? "운동 완료" : "휴식 기록"}</p>
        </div>

        <div className="share-grid">
          <div className="share-panel">
            <div className={`share-preview ratio-${ratio}`}>
              {firstImage && <img src={firstImage} alt="attendance" className="share-media" />}
              <div className="share-overlay" />
              {sticker && <div className="share-sticker">{sticker}</div>}

              <div className="share-content">
                <p className="text-xs uppercase tracking-[0.2em] text-white/70">MuscleUp</p>
                <h2 className="text-2xl font-black mt-2">{data.didWorkout ? "Workout Complete" : "Recovery Day"}</h2>
                <p className="text-sm text-white/80 mt-1">{data.authorNickname ?? "회원"} · {data.date}</p>

                <div className="share-badges">
                  {(data.workoutTypes ?? []).slice(0, 3).map((type) => (
                    <span key={type} className="share-badge">{type}</span>
                  ))}
                  {data.workoutIntensity && <span className="share-badge">강도 {data.workoutIntensity}</span>}
                </div>

                <p className={`share-quote quote-${quoteStyle}`}>{customMessage || data.shareComment || data.memo || "오늘 출석 완료!"}</p>

                {showMeta && (
                  <p className="share-meta">응원 {data.cheerCount} · 신고 {data.reportCount} · MuscleUp Share</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-black/20 p-4 mt-4 text-sm">
              <p className="text-white/80 whitespace-pre-line">{data.memo || "메모 없음"}</p>
            </div>
          </div>

          <div className="share-panel">
            <div className="control-row">
              <p className="control-title">Theme</p>
              <div className="choice-wrap">
                {THEME_OPTIONS.map((option) => (
                  <button key={option.id} className={`choice-btn ${theme === option.id ? "active" : ""}`} onClick={() => setTheme(option.id)}>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-row">
              <p className="control-title">Image Ratio</p>
              <div className="choice-wrap">
                {RATIO_OPTIONS.map((option) => (
                  <button key={option.id} className={`choice-btn ${ratio === option.id ? "active" : ""}`} onClick={() => setRatio(option.id)}>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-row">
              <p className="control-title">Quote Style</p>
              <div className="choice-wrap">
                {QUOTE_OPTIONS.map((option) => (
                  <button key={option.id} className={`choice-btn ${quoteStyle === option.id ? "active" : ""}`} onClick={() => setQuoteStyle(option.id)}>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-row">
              <p className="control-title">Sticker</p>
              <div className="choice-wrap">
                {STICKERS.map((item) => (
                  <button key={item || "none"} className={`choice-btn ${sticker === item ? "active" : ""}`} onClick={() => setSticker(item)}>
                    {item || "None"}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-row">
              <p className="control-title">Brag Message</p>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="comment-editor"
                maxLength={280}
                placeholder="자랑 멘트를 적어보세요"
              />
              <p className="text-xs text-white/60 mt-2">{customMessage.length}/280</p>
            </div>

            <div className="control-row flex items-center gap-2">
              <input id="meta-toggle" type="checkbox" checked={showMeta} onChange={(e) => setShowMeta(e.target.checked)} />
              <label htmlFor="meta-toggle" className="text-sm text-white/80">응원/공유 메타 표시</label>
            </div>

            <div className="action-list">
              <button className="action-btn primary" onClick={quickShare}>원클릭 공유</button>
              <button className="action-btn" onClick={async () => { await navigator.clipboard.writeText(composeShareText()); alert("멘트와 링크를 복사했어요."); }}>
                멘트+링크 복사
              </button>
              <button className="action-btn" onClick={kakaoShare}>카카오 공유</button>
              <button className="action-btn" onClick={saveImage}>커스텀 카드 저장</button>
              <button disabled={sending} className="action-btn" onClick={() => sendReaction("cheer")}>응원하기 {data.cheerCount}</button>
              <button disabled={sending} className="action-btn" onClick={() => sendReaction("report")}>신고하기</button>
              <Link to="/" className="action-btn">홈으로</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
