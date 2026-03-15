import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

type ShareData = {
  id: number;
  date: string;
  didWorkout: boolean;
  memo?: string | null;
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

export default function AttendanceShareView() {
  const { slug } = useParams();
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

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

  const kakaoShare = () => {
    if (!shareLink) return;
    const storyUrl = `https://story.kakao.com/share?url=${encodeURIComponent(shareLink)}`;
    window.open(storyUrl, "_blank", "noopener,noreferrer");
  };

  const saveImageForInsta = async () => {
    if (!firstImage) {
      alert("저장할 이미지가 없어요. 영상만 있는 경우 수동으로 캡처해 주세요.");
      return;
    }
    const a = document.createElement("a");
    a.href = firstImage;
    a.download = `attendance-${data?.date ?? "share"}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const sendReaction = async (kind: "cheer" | "report") => {
    if (!data || sending) return;
    try {
      setSending(true);
      const res = await fetch(`${API_BASE}/api/attendance/share/${data.shareSlug}/${kind}`, { method: "POST" });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const payload: ShareData = await res.json();
      setData(payload);
      if (kind === "report") {
        alert("신고가 접수됐어요.");
      }
    } catch (e: any) {
      alert(e?.message || "처리에 실패했어요.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <section className="pt-28 pb-20 px-5 md:px-10 min-h-screen text-white bg-gradient-to-br from-[#0b0f1c] via-[#16142b] to-[#1c0f14]">
        <div className="max-w-4xl mx-auto">불러오는 중...</div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="pt-28 pb-20 px-5 md:px-10 min-h-screen text-white bg-gradient-to-br from-[#0b0f1c] via-[#16142b] to-[#1c0f14]">
        <div className="max-w-4xl mx-auto text-red-300">{error || "공유 페이지를 찾을 수 없습니다."}</div>
      </section>
    );
  }

  return (
    <section className="pt-28 pb-20 px-5 md:px-10 min-h-screen text-white bg-gradient-to-br from-[#0b0f1c] via-[#16142b] to-[#1c0f14]">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.25em] text-amber-200">Attendance Brag</p>
          <h1 className="text-3xl md:text-4xl font-extrabold">{title}</h1>
          <p className="text-sm text-white/70">
            {data.date} · {data.didWorkout ? "운동 완료" : "휴식 기록"}
          </p>
          <p className="text-xs text-white/50">
            최종 수정: {data.lastEditedAt ? new Date(data.lastEditedAt).toLocaleString("ko-KR") : "없음"}
          </p>
        </header>

        <div className="rounded-3xl border border-white/10 bg-black/30 p-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            {(data.workoutTypes ?? []).map((type) => (
              <span key={type} className="rounded-full border border-white/20 px-3 py-1 text-xs">{type}</span>
            ))}
            {data.workoutIntensity && (
              <span className="rounded-full border border-orange-400/60 px-3 py-1 text-xs text-orange-200">
                강도: {data.workoutIntensity}
              </span>
            )}
          </div>
          <p className="whitespace-pre-line text-white/90">{data.memo || "메모 없음"}</p>
        </div>

        {(data.mediaUrls?.length ?? 0) > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(data.mediaUrls ?? []).map((rawUrl) => {
              const url = withBase(rawUrl);
              return (
                <div key={rawUrl} className="rounded-2xl overflow-hidden border border-white/10 bg-black/20">
                  {isVideo(url) ? <video src={url} className="w-full h-72 object-cover" controls /> : <img src={url} alt="attendance media" className="w-full h-72 object-cover" />}
                </div>
              );
            })}
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 flex flex-wrap items-center gap-3 text-sm">
          <button disabled={sending} className="rounded-xl border border-emerald-400/50 px-4 py-2 text-emerald-200" onClick={() => sendReaction("cheer")}>응원하기 👍 {data.cheerCount}</button>
          <button disabled={sending} className="rounded-xl border border-red-400/50 px-4 py-2 text-red-200" onClick={() => sendReaction("report")}>신고하기 🚨</button>
          <span className="text-white/60">신고 수: {data.reportCount}</span>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className="rounded-xl border border-amber-400/60 px-4 py-2 text-sm text-amber-200" onClick={async () => { await navigator.clipboard.writeText(shareLink); alert("링크를 복사했어요."); }}>
            링크 복사
          </button>
          <button className="rounded-xl border border-yellow-400/60 px-4 py-2 text-sm text-yellow-200" onClick={kakaoShare}>
            카카오 공유
          </button>
          <button className="rounded-xl border border-fuchsia-400/60 px-4 py-2 text-sm text-fuchsia-200" onClick={saveImageForInsta}>
            인스타용 이미지 저장
          </button>
          <Link to="/" className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white/70">홈으로</Link>
        </div>
      </div>
    </section>
  );
}
