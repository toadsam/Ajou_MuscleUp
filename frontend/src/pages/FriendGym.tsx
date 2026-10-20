import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { Link, useParams } from "react-router-dom";
import AvatarRenderer from "../components/avatar/AvatarRenderer";
import type { CharacterTier } from "../components/avatar/types";
import { DEFAULT_LAYOUT, type DecorLayout, type SceneId } from "../components/gymMap/decor";
import { SCENES } from "../components/gymMap/scenes";
import ReportDialog from "../components/ReportDialog";
import { MAP_H, MAP_W, createGymMap, toneForMbti, type GymMapController } from "../components/gymMap/engine";
import { errorStatus, friendlyError } from "../lib/httpError";
import { GUESTBOOK_MAX, deleteGuestbook, fetchFriendGym, writeGuestbook, type FriendGym as FriendGymView } from "../lib/gymVisit";
import { timeAgo } from "../lib/timeAgo";
import { toast } from "../lib/toast";
import { logEvent } from "../utils/analytics";

// 친구 헬스장 구경 — 친구가 꾸민 헬스장(물품 · 테마 · 직원)을 내 캐릭터로 걸어 다니며 보고, 방명록에 한 줄 남긴다.
// 친구 헬스장의 장소(출석 체크기 등)는 눌러도 아무 화면도 열지 않는다(내 기록 화면으로 가면 헷갈려서).
// 친구가 연 공간(2층 · 러닝 트랙 · 식당)은 지도 위 칸으로 오간다. 다른 공간의 출구에 서면 1층으로.

/** 서버가 준 한국어 message 는 살리고, 그 밖은 우리 문장으로 */
function apiErrorMessage(e: unknown, fallback: string) {
  const message = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  if (typeof message === "string" && /[가-힣]/.test(message) && message.length <= 120) return message;
  return friendlyError(e, fallback);
}

export default function FriendGym() {
  const { userId } = useParams();
  const id = Number(userId);
  const [gym, setGym] = useState<FriendGymView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [scene, setScene] = useState<SceneId>("MAIN");
  const [reportId, setReportId] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<GymMapController | null>(null);

  useEffect(() => {
    if (!Number.isFinite(id)) {
      setError("친구의 헬스장만 구경할 수 있어요.");
      return;
    }
    let alive = true;
    fetchFriendGym(id)
      .then((data) => {
        if (!alive) return;
        setGym(data);
        void logEvent("friends", "gym_visit", {});
      })
      .catch((e) => alive && setError(errorStatus(e) === 404 ? "친구의 헬스장만 구경할 수 있어요." : friendlyError(e, "헬스장을 불러오지 못했어요.")));
    return () => {
      alive = false;
    };
  }, [id]);

  // 방명록을 쓸 때는 지도를 다시 만들지 않게 모습(slots)에만 묶는다
  const slots = gym?.slots;
  const ready = Boolean(gym);
  const layout = useMemo<DecorLayout>(
    () => (slots ? (Object.fromEntries(slots.map((s) => [s.slot, s.code])) as DecorLayout) : DEFAULT_LAYOUT),
    [slots],
  );

  // 지도는 한 번 만들고, 친구 헬스장 모습이 오면 넣는다. 원판 · 출석 표시는 쓰지 않는다
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;
    const map = createGymMap(
      canvas,
      { plates: 0, checked: true, loungeCount: 0, tone: toneForMbti(null), decor: layout },
      {
        // 출구에 서면 1층으로(포탈 창 대신 지도 위 칸을 쓴다)
        onZone: (z) => {
          if (z === "exit") {
            map.setState({ scene: "MAIN" });
            setScene("MAIN");
          }
        },
        onPlayer: () => undefined,
        onPlateLanded: () => undefined,
      },
    );
    setScene("MAIN");
    mapRef.current = map;
    return () => {
      map.destroy();
      mapRef.current = null;
    };
  }, [ready, layout]);

  const goScene = (next: SceneId) => {
    mapRef.current?.setState({ scene: next });
    setScene(next);
    void logEvent("friends", "gym_visit_scene", { scene: next });
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    mapRef.current?.tapAt((e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const message = draft.trim();
    if (!message || sending || !gym) return;
    setSending(true);
    try {
      const entry = await writeGuestbook(gym.userId, message);
      setGym((g) => (g ? { ...g, guestbook: [entry, ...g.guestbook] } : g));
      setDraft("");
      toast("방명록을 남겼어요", "success");
      void logEvent("friends", "guestbook_write", {});
    } catch (err) {
      toast(apiErrorMessage(err, "방명록을 남기지 못했어요. 잠시 뒤 다시 해 주세요."), "error");
    } finally {
      setSending(false);
    }
  };

  const remove = async (entryId: number) => {
    try {
      await deleteGuestbook(entryId);
      setGym((g) => (g ? { ...g, guestbook: g.guestbook.filter((x) => x.id !== entryId) } : g));
    } catch (err) {
      toast(apiErrorMessage(err, "지우지 못했어요."), "error");
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-10 text-center">
        <p className="text-steel-300">{error}</p>
        <Link to="/friends" className="dg-btn dg-btn-steel inline-flex">
          친구 목록으로
        </Link>
      </div>
    );
  }

  const c = gym?.character;
  return (
    <div className="mx-auto max-w-[420px] space-y-4 px-4 py-6">
      <div className="flex items-center justify-between gap-2">
        <Link to="/friends" className="text-sm text-steel-300 hover:text-chalk">
          ← 친구 목록
        </Link>
        <span className="dg-chip text-xs">놀러 가기</span>
      </div>

      <section className="dg-steel flex items-center gap-3 p-3">
        <div className="flex-shrink-0 rounded-md border-2 border-black bg-steel-900 p-1">
          <AvatarRenderer
            avatarSeed={c?.avatarSeed ?? "friend-avatar"}
            tier={(c?.tier ?? "BRONZE") as CharacterTier}
            stage={c?.evolutionStage ?? 0}
            gender={c?.gender}
            isResting={c?.isResting ?? false}
            tank={c?.tank}
            pumped={c?.isPumped ?? false}
            bodyStage={c?.bodyStage}
            size={64}
          />
        </div>
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl">{gym ? `${gym.nickname}의 헬스장` : "헬스장 불러오는 중"}</h1>
          <p className="text-sm text-steel-300">{c?.title ? `"${c.title}" · ` : ""}바닥을 눌러 둘러봐요</p>
        </div>
      </section>

      {gym && gym.spaces.length > 1 && (
        <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="공간">
          {gym.spaces.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={scene === s}
              onClick={() => goScene(s)}
              className={`dg-chip flex-shrink-0 text-xs ${scene === s ? "bg-plate-yellow text-steel-950" : ""}`}
            >
              {s === "MAIN" ? "1층" : SCENES[s].name}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border-[3px] border-black bg-black">
        {gym ? (
          <canvas
            ref={canvasRef}
            width={MAP_W}
            height={MAP_H}
            onPointerDown={onPointerDown}
            className="block h-auto w-full cursor-pointer"
            style={{ imageRendering: "pixelated" }}
            aria-label={`${gym.nickname}의 헬스장 지도. 바닥을 눌러 걸을 수 있어요`}
          />
        ) : (
          <div className="dg-loading-plates aspect-[256/416] w-full" aria-label="불러오는 중" />
        )}
      </div>

      <section className="dg-steel space-y-3 p-4" aria-label="방명록">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg">방명록</h2>
          <span className="text-xs text-steel-400">친구들만 봐요</span>
        </div>
        <form onSubmit={(e) => void submit(e)} className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, GUESTBOOK_MAX))}
            maxLength={GUESTBOOK_MAX}
            placeholder="한 줄 남기기 (예: 헬스장 멋지다! 내일 같이 하체?)"
            aria-label="방명록 한 줄"
            className="min-w-0 flex-1 rounded-md border-2 border-black bg-steel-900 px-3 py-2 text-sm text-chalk placeholder:text-steel-500"
          />
          <button type="submit" disabled={!draft.trim() || sending || !gym} className="dg-btn dg-btn-primary flex-shrink-0 px-4 text-sm">
            남기기
          </button>
        </form>
        <p className="text-right font-num text-xs text-steel-500">
          {draft.length}/{GUESTBOOK_MAX}
        </p>
        {gym && gym.guestbook.length === 0 && <p className="text-sm text-steel-400">아직 남긴 사람이 없어요. 첫 방문 인사를 남겨 봐요.</p>}
        <ul className="space-y-2">
          {gym?.guestbook.map((entry) => (
            <li key={entry.id} className="dg-well flex items-start gap-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-steel-400">
                  <b className={entry.mine ? "text-plate-yellow" : "text-chalk"}>{entry.mine ? "나" : entry.nickname}</b> · {timeAgo(entry.createdAt)}
                </p>
                <p className="mt-1 break-words text-sm">{entry.message}</p>
              </div>
              {!entry.mine && (
                <button type="button" onClick={() => setReportId(entry.id)} className="flex-shrink-0 text-xs text-steel-400 hover:text-plate-yellow">
                  신고
                </button>
              )}
              {entry.canDelete && (
                <button type="button" onClick={() => void remove(entry.id)} className="flex-shrink-0 text-xs text-steel-400 hover:text-plate-red">
                  지우기
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
      <ReportDialog targetType="GYM_GUESTBOOK" targetId={reportId ?? 0} open={reportId !== null} onClose={() => setReportId(null)} />
    </div>
  );
}
