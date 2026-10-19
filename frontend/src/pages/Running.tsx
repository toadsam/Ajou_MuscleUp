import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import DialogFrame from "../components/DialogFrame";
import RouteSvg from "../components/running/RouteSvg";
import RunTrack from "../components/running/RunTrack";
import RunShareEditor from "../components/running/RunShareEditor";
import BossFight from "../components/boss/BossFight";
import type { RunShareData } from "../lib/runShareCard";
import type { StageCharacter } from "../components/workout/LiftStage";
import { useLiveHeartbeat, useLiveVisible } from "../lib/live";
import { api } from "../lib/api";
import { toast } from "../lib/toast";
import { friendlyError } from "../lib/httpError";
import { BOX_REASON } from "../lib/collection";
import { formatClock } from "../lib/workoutSession";
import {
  GOOD_ACCURACY,
  applyFix,
  clearRun,
  currentPace,
  deleteRoute,
  formatKm,
  formatPace,
  loadRoute,
  loadRun,
  movingSec,
  newRun,
  pause,
  resume,
  saveRun,
  splitsForSave,
  spokenPace,
  storeRoute,
  type ActiveRun,
  type LatLng,
  type RunRecord,
  type RunRecords,
  type RunSaveResult,
  type RunView,
} from "../lib/running";

// 러닝(나이키 런클럽처럼). 시작 → GPS 를 잡으면 거리 · 시간 · 페이스를 재고 1km 마다 음성 안내 → 멈춤 → 끝내기.
// 진행 중 상태는 이 기기에만, 끝낼 때 거리 · 시간 · 구간만 POST /api/runs. 지나간 경로는 이 기기에만 남긴다.
// 웹앱이라 화면이 꺼지면 위치를 못 받는다 — 화면 켜 두기(Wake Lock)를 자동으로 요청하고, 켜 둔 채 달리도록 안내한다.

type WakeLockLike = { release: () => Promise<void> };

const VOICE_KEY = "dg-run-voice";

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [active]);
  return now;
}

function speak(text: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    // 음성을 못 써도 진동 · 화면은 된다
  }
}

function recordValue(r: { type: RunRecord["type"]; value: number }) {
  return r.type === "DISTANCE" ? `${formatKm(r.value)}km` : formatClock(r.value);
}

function SplitBars({ splits }: { splits: number[] }) {
  if (splits.length === 0) return null;
  const fastest = Math.min(...splits);
  return (
    <ol className="space-y-1 text-sm">
      {splits.map((s, i) => (
        <li key={i} className="flex items-center gap-2">
          <span className="w-10 flex-none font-num text-steel-400">{i + 1}km</span>
          <span className="h-3 flex-1 overflow-hidden rounded bg-steel-800" aria-hidden="true">
            <i
              className={`block h-full ${s === fastest ? "bg-plate-yellow" : "bg-steel-500"}`}
              style={{ width: `${Math.max(12, (fastest / s) * 100)}%` }}
            />
          </span>
          <span className="w-14 flex-none text-right font-num text-base">{formatPace(s)}</span>
        </li>
      ))}
    </ol>
  );
}

export default function Running() {
  const [run, setRun] = useState<ActiveRun | null>(() => loadRun());
  const [acquiring, setAcquiring] = useState(false);
  const [fixAccuracy, setFixAccuracy] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [voiceOn, setVoiceOn] = useState(() => {
    try {
      return localStorage.getItem(VOICE_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [checkAttendance, setCheckAttendance] = useState(true);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ save: RunSaveResult; route: LatLng[] | null } | null>(null);
  // 공유 카드 만들기(사진 + 거리 · 페이스 · 코스)
  const [shareData, setShareData] = useState<RunShareData | null>(null);
  const [records, setRecords] = useState<RunRecords | null>(null);
  const [runs, setRuns] = useState<RunView[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [gapNotice, setGapNotice] = useState(false);
  const [manual, setManual] = useState({ km: "", min: "", sec: "" });
  const runRef = useRef(run);
  const announcedRef = useRef(run?.splits.length ?? 0);
  const savedAtRef = useRef(0);
  const hiddenAtRef = useRef<number | null>(null);
  const wakeRef = useRef<WakeLockLike | null>(null);
  const now = useNow(Boolean(run));
  // 같이 달리는 캐릭터 · 라운지 "운동 구역"에 러닝 중으로 보이기
  const [character, setCharacter] = useState<StageCharacter | null>(null);
  const [mbti, setMbti] = useState<string | null>(null);
  const [liveVisible, toggleLive] = useLiveVisible();
  const runActive = Boolean(run);
  useLiveHeartbeat(runActive && run?.pausedAt == null && liveVisible, "RUN");
  useEffect(() => {
    if (!runActive || character) return;
    let alive = true;
    void api
      .get<StageCharacter>("/api/character/me")
      .then((res) => alive && setCharacter(res.data))
      .catch(() => undefined);
    void api
      .get<{ mbti?: string | null }>("/api/mypage/stats")
      .then((res) => alive && setMbti(res.data?.mbti ?? null))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [runActive, character]);
  const watching = acquiring || Boolean(run);

  const load = useCallback(async () => {
    try {
      const [recordsRes, runsRes] = await Promise.all([api.get<RunRecords>("/api/runs/records"), api.get<RunView[]>("/api/runs")]);
      setRecords(recordsRes.data);
      setRuns(runsRes.data);
    } catch (e: unknown) {
      toast(friendlyError(e, "러닝 기록을 불러오지 못했어요."), "error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // 이 기기에 저장(2초에 한 번 + 화면을 떠날 때)
  useEffect(() => {
    runRef.current = run;
    if (run && Date.now() - savedAtRef.current > 2000) {
      saveRun(run);
      savedAtRef.current = Date.now();
    }
  }, [run]);

  // GPS
  useEffect(() => {
    if (!watching) return;
    if (!("geolocation" in navigator)) {
      setGpsError("이 브라우저에서는 위치를 쓸 수 없어요. 러닝머신 · 직접 입력을 써 주세요.");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsError(null);
        setFixAccuracy(Math.round(pos.coords.accuracy));
        const fix = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, time: Date.now() };
        setRun((prev) => (prev ? applyFix(prev, fix) : prev));
      },
      (err) => {
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? "위치 권한이 꺼져 있어요. 브라우저 설정에서 이 사이트의 위치를 허용해 주세요."
            : "GPS 신호를 찾고 있어요. 하늘이 트인 곳으로 나가 보세요.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [watching]);

  // GPS 가 잡히면 출발
  useEffect(() => {
    if (acquiring && fixAccuracy != null && fixAccuracy <= GOOD_ACCURACY) {
      setAcquiring(false);
      setRun(newRun());
      if (voiceOn) speak("러닝을 시작합니다");
    }
  }, [acquiring, fixAccuracy, voiceOn]);

  // 1km 마다 음성 · 진동
  useEffect(() => {
    if (!run) return;
    const n = run.splits.length;
    if (n <= announcedRef.current) return;
    announcedRef.current = n;
    const split = run.splits[n - 1];
    const avg = (run.lastSplitAt / n) | 0;
    try {
      navigator.vibrate?.([300, 120, 300]);
    } catch {
      // 진동을 못 쓰는 기기
    }
    if (voiceOn) speak(`${n}킬로미터. 이번 구간 ${spokenPace(split)}. 평균 페이스 ${spokenPace(avg)}.`);
  }, [run, voiceOn]);

  // 화면 켜 두기 — 달리는 동안 자동으로, 다른 앱에 다녀오면 다시 요청
  const hasRun = Boolean(run);
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockLike> } };
    if (!hasRun || !nav.wakeLock) return;
    let cancelled = false;
    const acquire = async () => {
      try {
        const lock = await nav.wakeLock!.request("screen");
        if (cancelled) void lock.release();
        else wakeRef.current = lock;
      } catch {
        // 배터리 절약 모드 등으로 거절될 수 있다
      }
    };
    void acquire();
    const onVisible = () => document.visibilityState === "visible" && void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void wakeRef.current?.release().catch(() => undefined);
      wakeRef.current = null;
    };
  }, [hasRun]);

  // 화면이 꺼졌다 켜지면: 저장하고, 오래 꺼져 있었으면 알려 준다(그동안은 직선 거리로 이어짐)
  useEffect(() => {
    const onVisibility = () => {
      const r = runRef.current;
      if (document.visibilityState === "hidden") {
        if (r) saveRun(r);
        hiddenAtRef.current = r && r.pausedAt == null ? Date.now() : null;
      } else if (hiddenAtRef.current && Date.now() - hiddenAtRef.current > 15000) {
        setGapNotice(true);
        hiddenAtRef.current = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onVisibility);
    };
  }, []);

  const toggleVoice = (on: boolean) => {
    setVoiceOn(on);
    try {
      localStorage.setItem(VOICE_KEY, on ? "on" : "off");
    } catch {
      // ignore
    }
  };

  const start = () => {
    // 음성은 사용자가 누른 순간에 한 번 열어 둬야 나중에 나온다(iOS)
    if (voiceOn) speak("GPS를 찾고 있어요");
    setResult(null);
    setGapNotice(false);
    setFixAccuracy(null);
    announcedRef.current = 0;
    setAcquiring(true);
  };

  const startAnyway = () => {
    setAcquiring(false);
    setRun(newRun());
  };

  const togglePause = () => {
    setRun((r) => {
      if (!r) return r;
      const next = r.pausedAt == null ? pause(r) : resume(r);
      saveRun(next);
      return next;
    });
  };

  const openFinish = () => {
    setRun((r) => (r ? pause(r) : r));
    setFinishOpen(true);
  };

  const finish = async () => {
    const r = run;
    if (!r || saving) return;
    const durationSec = Math.round(movingSec(r));
    const distanceM = Math.round(r.distanceM);
    setSaving(true);
    try {
      const res = await api.post<RunSaveResult>("/api/runs", {
        startedAt: new Date(r.startedAt).toISOString(),
        endedAt: new Date().toISOString(),
        durationSec,
        distanceM,
        splits: splitsForSave(r, durationSec),
        source: "GPS",
        checkAttendance,
        note: note.trim() || null,
      });
      storeRoute(res.data.run.id, r.route);
      clearRun();
      setRun(null);
      setFinishOpen(false);
      setNote("");
      setResult({ save: res.data, route: r.route.length > 1 ? r.route : null });
      void load();
    } catch (e: unknown) {
      toast(friendlyError(e, "저장하지 못했어요. 잠시 뒤 다시 눌러 주세요."), "error");
    } finally {
      setSaving(false);
    }
  };

  const saveManual = async (e: FormEvent) => {
    e.preventDefault();
    const km = Number(manual.km);
    const sec = (Number(manual.min) || 0) * 60 + (Number(manual.sec) || 0);
    if (!(km >= 0.1 && km <= 100) || !(sec >= 60)) {
      toast("거리(0.1km 이상)와 시간(1분 이상)을 적어 주세요.", "error");
      return;
    }
    setSaving(true);
    try {
      const end = Date.now();
      const res = await api.post<RunSaveResult>("/api/runs", {
        startedAt: new Date(end - sec * 1000).toISOString(),
        endedAt: new Date(end).toISOString(),
        durationSec: sec,
        distanceM: Math.round(km * 1000),
        source: "MANUAL",
        checkAttendance,
        note: note.trim() || null,
      });
      setManualOpen(false);
      setManual({ km: "", min: "", sec: "" });
      setNote("");
      setResult({ save: res.data, route: null });
      void load();
    } catch (err: unknown) {
      toast(friendlyError(err, "저장하지 못했어요."), "error");
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    clearRun();
    setRun(null);
    setDiscardOpen(false);
  };

  const removeRun = async (id: number) => {
    if (!window.confirm("이 러닝 기록을 지울까요?")) return;
    try {
      await api.delete(`/api/runs/${id}`);
      deleteRoute(id);
      setOpenId(null);
      await load();
    } catch (e: unknown) {
      toast(friendlyError(e, "지우지 못했어요."), "error");
    }
  };

  if (shareData) return <RunShareEditor data={shareData} onClose={() => setShareData(null)} />;

  // ── 끝난 뒤 결과
  if (result) {
    const r = result.save.run;
    return (
      <section className="min-h-screen px-4 pb-20 pt-28 text-white md:px-10">
        <div className="mx-auto max-w-2xl space-y-5">
          <header className="space-y-1">
            <p className="text-sm font-bold text-plate-yellow">러닝 끝</p>
            <h1 className="text-3xl">수고했어요!</h1>
          </header>
          {result.save.shadow && <BossFight hit={result.save.shadow} character={character} mbti={mbti} motion={{ kind: "run", equip: "none" }} />}
          <div className="dg-steel p-4 text-center">
            <p className="font-num text-6xl leading-none">
              {formatKm(r.distanceM)}
              <span className="ml-1 text-2xl text-steel-400">km</span>
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-steel-400">시간</p>
                <p className="font-num text-2xl">{formatClock(r.durationSec)}</p>
              </div>
              <div>
                <p className="text-xs text-steel-400">평균 페이스</p>
                <p className="font-num text-2xl">{formatPace(r.paceSec)}</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShareData({ distanceM: r.distanceM, durationSec: r.durationSec, paceSec: r.paceSec, startedAt: r.startedAt, route: result.route })}
            className="dg-btn dg-btn-primary min-h-[56px] w-full text-lg"
          >
            사진으로 공유하기
          </button>
          {result.save.records.length > 0 && (
            <div className="dg-steel space-y-2 p-4">
              <h2 className="font-display text-xl text-plate-yellow">새 기록 {result.save.records.length}개!</h2>
              <ul className="space-y-1 text-sm">
                {result.save.records.map((rec) => (
                  <li key={rec.type}>
                    <strong>{rec.label}</strong> <span className="font-num text-lg">{recordValue(rec)}</span>
                    {rec.previous != null ? ` (이전 ${recordValue({ type: rec.type, value: rec.previous })})` : " (첫 기록)"}
                  </li>
                ))}
              </ul>
              {result.save.points > 0 && <p className="text-sm font-semibold text-plate-yellow">활동 점수 +{result.save.points}</p>}
            </div>
          )}
          {result.save.attendance.created && (
            <p className="dg-well p-3 text-sm text-steel-200">
              오늘 출석도 체크했어요{result.save.attendance.expEarned ? ` (+${result.save.attendance.expEarned})` : ""}.
              {result.save.attendance.weeklyGoalBonus ? ` 주간 목표 달성 보너스 +${result.save.attendance.weeklyGoalBonus}!` : ""}
            </p>
          )}
          {result.save.attendance.rewardBox && (
            <Link to="/collection" className="dg-steel flex items-center gap-3 p-3 text-sm">
              <span className="flex-1 font-semibold">{BOX_REASON[result.save.attendance.rewardBox] ?? "보상 상자"}를 받았어요!</span>
              <span className="dg-btn dg-btn-primary min-h-[36px] px-3 text-xs">열러 가기</span>
            </Link>
          )}
          {(r.splits.length > 0 || result.route) && (
            <div className="dg-steel grid gap-4 p-4 sm:grid-cols-2">
              {result.route && (
                <div className="mx-auto w-full max-w-[240px]">
                  <RouteSvg route={result.route} />
                  <p className="mt-1 text-center text-xs text-steel-500">달린 길은 이 휴대폰에만 저장돼요.</p>
                </div>
              )}
              {r.splits.length > 0 && (
                <div>
                  <h2 className="mb-2 font-display text-lg">구간</h2>
                  <SplitBars splits={r.splits} />
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setResult(null)} className="dg-btn dg-btn-primary min-h-[44px] flex-1 text-base">
              러닝 기록 보기
            </button>
            <Link to="/" className="dg-btn dg-btn-steel min-h-[44px] flex-1 text-base">
              홈으로
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // ── 달리는 중
  if (run) {
    const paused = run.pausedAt != null;
    const moving = movingSec(run, now);
    const avgPace = run.distanceM >= 50 ? (moving / run.distanceM) * 1000 : null;
    const pace = paused ? null : currentPace(run);
    const acc = run.accuracy;
    return (
      <section className="min-h-screen px-4 pb-24 pt-24 text-white md:px-10">
        <div className="mx-auto max-w-md space-y-4">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className={`dg-chip ${paused ? "text-plate-yellow" : "text-plate-green"}`}>{paused ? "멈춤" : "달리는 중"}</span>
            <span className="text-steel-400" aria-live="polite">
              {gpsError
                ? gpsError
                : acc == null
                  ? "GPS 찾는 중"
                  : acc <= 15
                    ? `GPS 좋음 · ±${acc}m`
                    : acc <= GOOD_ACCURACY
                      ? `GPS 보통 · ±${acc}m`
                      : `GPS 약함 · ±${acc}m (거리를 세지 않아요)`}
            </span>
          </div>

          <div className="dg-steel p-5 text-center">
            <p className="font-num text-8xl leading-none" aria-label={`${formatKm(run.distanceM)}킬로미터`}>
              {formatKm(run.distanceM)}
            </p>
            <p className="text-sm text-steel-400">킬로미터</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div>
                <p className="text-xs text-steel-400">시간</p>
                <p className="font-num text-2xl">{formatClock(moving)}</p>
              </div>
              <div>
                <p className="text-xs text-steel-400">평균 페이스</p>
                <p className="font-num text-2xl">{formatPace(avgPace)}</p>
              </div>
              <div>
                <p className="text-xs text-steel-400">지금 페이스</p>
                <p className="font-num text-2xl">{formatPace(pace)}</p>
              </div>
            </div>
          </div>

          <RunTrack character={character} mbti={mbti} pace={pace} paused={paused} distanceM={run.distanceM} />

          {gapNotice && (
            <p className="dg-well p-3 text-sm text-plate-yellow" role="status">
              화면이 꺼져 있던 동안은 위치를 받지 못해 그 사이는 직선 거리로 이어졌어요. 화면을 켜 둔 채 달려 주세요.
            </p>
          )}

          {paused ? (
            <div className="flex gap-2">
              <button type="button" onClick={togglePause} className="dg-btn dg-btn-primary min-h-[64px] flex-1 text-xl">
                다시 달리기
              </button>
              <button type="button" onClick={openFinish} className="dg-btn dg-btn-steel min-h-[64px] flex-1 text-xl">
                끝내기
              </button>
            </div>
          ) : (
            <button type="button" onClick={togglePause} className="dg-btn dg-btn-primary min-h-[72px] w-full text-2xl">
              멈춤
            </button>
          )}

          <div className="flex items-center justify-between gap-2 text-xs text-steel-400">
            <span>화면을 켜 둔 채 달려 주세요.</span>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={voiceOn} onChange={(e) => toggleVoice(e.target.checked)} className="h-4 w-4" />
              1km 음성 안내
            </label>
          </div>
          <label className="flex items-center justify-end gap-1.5 text-xs text-steel-400">
            <input type="checkbox" checked={liveVisible} onChange={toggleLive} className="h-4 w-4" />
            라운지에 러닝 중으로 보이기
          </label>

          {run.splits.length > 0 && (
            <div className="dg-steel p-4">
              <h2 className="mb-2 font-display text-lg">구간</h2>
              <SplitBars splits={run.splits} />
            </div>
          )}

          <button type="button" onClick={() => setDiscardOpen(true)} className="block w-full text-center text-xs text-steel-500 underline underline-offset-4">
            기록하지 않고 그만두기
          </button>
        </div>

        <DialogFrame open={finishOpen} onClose={() => setFinishOpen(false)} title="러닝 끝내기" busy={saving}>
          <div className="space-y-3 text-sm">
            <p className="text-steel-300">
              {formatKm(run.distanceM)}km · {formatClock(moving)} · 평균 {formatPace(avgPace)}
            </p>
            {run.distanceM < 100 && <p className="text-red-300">100m 이상 달려야 저장할 수 있어요.</p>}
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={checkAttendance} onChange={(e) => setCheckAttendance(e.target.checked)} className="h-5 w-5" />
              오늘 출석도 체크하기(아직 안 했을 때)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              rows={2}
              placeholder="한 줄 메모(선택)"
              aria-label="메모"
              className="dg-well w-full px-3 py-2 text-white"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setFinishOpen(false);
                  togglePause();
                }}
                disabled={saving}
                className="dg-btn dg-btn-steel min-h-[44px] flex-1"
              >
                계속 달리기
              </button>
              <button
                type="button"
                onClick={() => void finish()}
                disabled={saving || run.distanceM < 100}
                className="dg-btn dg-btn-primary min-h-[44px] flex-1"
              >
                {saving ? "저장 중..." : "저장하고 끝내기"}
              </button>
            </div>
          </div>
        </DialogFrame>

        <DialogFrame open={discardOpen} onClose={() => setDiscardOpen(false)} title="기록하지 않고 그만둘까요?" tone="danger">
          <div className="space-y-3 text-sm">
            <p className="text-steel-300">지금까지 달린 기록이 모두 사라져요.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDiscardOpen(false)} className="dg-btn dg-btn-steel min-h-[44px] flex-1">
                계속하기
              </button>
              <button type="button" onClick={discard} className="dg-btn dg-btn-primary min-h-[44px] flex-1">
                그만두기
              </button>
            </div>
          </div>
        </DialogFrame>
      </section>
    );
  }

  // ── 시작 전: 시작 · 내 기록 · 이번 달 러닝
  const recordTiles: { label: string; value: string }[] = [
    { label: "가장 긴 거리", value: records?.longestM ? `${formatKm(records.longestM)}km` : "-" },
    { label: "가장 빠른 1km", value: records?.best1kSec ? formatClock(records.best1kSec) : "-" },
    { label: "가장 빠른 5km", value: records?.best5kSec ? formatClock(records.best5kSec) : "-" },
    { label: "가장 빠른 10km", value: records?.best10kSec ? formatClock(records.best10kSec) : "-" },
  ];
  return (
    <section className="min-h-screen px-4 pb-20 pt-28 text-white md:px-10">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="space-y-2">
          <p className="text-sm font-bold text-plate-yellow">러닝</p>
          <h1 className="text-3xl">오늘 달려 볼까요?</h1>
          <p className="text-sm text-steel-400">
            GPS로 거리 · 시간 · 페이스를 재고 1km마다 알려 줘요. 달린 길은 이 휴대폰에만 남고, 서버에는 거리 · 시간만 저장해요.
          </p>
        </header>

        {acquiring ? (
          <div className="dg-steel space-y-3 p-4 text-center" role="status">
            <div className="dg-loading-plates mx-auto" aria-hidden="true" />
            <p className="font-display text-xl">GPS 찾는 중</p>
            <p className="text-sm text-steel-400">
              {gpsError ?? (fixAccuracy != null ? `정확도 ±${fixAccuracy}m — ±${GOOD_ACCURACY}m 안으로 들어오면 출발해요` : "밖으로 나가 잠깐 기다려 주세요")}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAcquiring(false)} className="dg-btn dg-btn-steel min-h-[44px] flex-1">
                취소
              </button>
              <button type="button" onClick={startAnyway} className="dg-btn dg-btn-steel min-h-[44px] flex-1">
                그냥 시작
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={start} className="dg-btn dg-btn-primary min-h-[64px] w-full text-xl">
            러닝 시작
          </button>
        )}
        <div className="flex items-center justify-between gap-2 text-sm">
          <button type="button" onClick={() => setManualOpen(true)} className="text-steel-300 underline underline-offset-4">
            러닝머신 · 직접 입력
          </button>
          <label className="flex items-center gap-1.5 text-xs text-steel-400">
            <input type="checkbox" checked={voiceOn} onChange={(e) => toggleVoice(e.target.checked)} className="h-4 w-4" />
            1km 음성 안내
          </label>
        </div>

        <div className="dg-steel p-4 md:p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-xl">내 기록</h2>
            {records && (
              <p className="text-sm text-steel-400">
                이번 주 <span className="font-num text-lg text-white">{formatKm(records.weekDistanceM)}</span>km · {records.weekRuns}번
              </p>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {recordTiles.map((t) => (
              <div key={t.label} className="dg-well p-3">
                <p className="text-xs text-steel-400">{t.label}</p>
                <p className="font-num text-2xl">{t.value}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-steel-500">기록을 깨면 활동 점수 +5(하루 10점까지). 속도 기록은 GPS로 잰 러닝만 비교해요.</p>
        </div>

        {runs.length > 0 && (
          <div className="dg-steel p-4 md:p-5">
            <h2 className="font-display text-xl">
              이번 달 러닝 {runs.length}번 · {formatKm(records?.monthDistanceM ?? 0)}km
            </h2>
            <ul className="mt-2 divide-y-2 divide-dashed divide-steel-700">
              {runs.map((r) => {
                const opened = openId === r.id;
                const route = opened ? loadRoute(r.id) : null;
                return (
                  <li key={r.id} className="py-2">
                    <button
                      type="button"
                      onClick={() => setOpenId(opened ? null : r.id)}
                      aria-expanded={opened}
                      className="flex w-full items-start justify-between gap-3 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block font-semibold">
                          {r.date.slice(5).replace("-", "/")} · {formatClock(r.durationSec)}
                          {r.source === "MANUAL" && <span className="ml-1 text-xs text-steel-400">직접 입력</span>}
                        </span>
                        <span className="block text-sm text-steel-400">평균 {formatPace(r.paceSec)}</span>
                      </span>
                      <span className="flex-none text-right">
                        <span className="font-num text-2xl">{formatKm(r.distanceM)}</span>
                        <span className="text-sm text-steel-400">km</span>
                      </span>
                    </button>
                    {opened && (
                      <div className="mt-2 space-y-3 rounded bg-steel-900/60 p-3 text-sm">
                        {route && (
                          <div className="mx-auto max-w-[240px]">
                            <RouteSvg route={route} />
                          </div>
                        )}
                        <SplitBars splits={r.splits} />
                        {r.splits.length === 0 && r.source === "GPS" && <p className="text-steel-400">1km를 다 채운 구간이 없어요.</p>}
                        {r.note && <p className="text-steel-300">"{r.note}"</p>}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setShareData({ distanceM: r.distanceM, durationSec: r.durationSec, paceSec: r.paceSec, startedAt: r.startedAt, route })}
                            className="dg-btn dg-btn-primary min-h-[32px] px-3 text-xs"
                          >
                            공유 카드
                          </button>
                          <button type="button" onClick={() => void removeRun(r.id)} className="dg-btn dg-btn-steel min-h-[32px] px-3 text-xs">
                            이 러닝 지우기
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <Link to="/workout" className="block text-center text-sm text-steel-400 underline underline-offset-4">
          헬스 운동 기록으로
        </Link>
      </div>

      <DialogFrame open={manualOpen} onClose={() => setManualOpen(false)} title="러닝머신 · 직접 입력" busy={saving}>
        <form onSubmit={saveManual} className="space-y-3 text-sm">
          <p className="text-steel-400">오늘 달린 거리와 시간을 적어 주세요. 직접 입력은 거리 기록만 비교해요.</p>
          <label className="block">
            <span className="text-xs text-steel-400">거리(km)</span>
            <input
              type="number"
              inputMode="decimal"
              min={0.1}
              max={100}
              step={0.01}
              value={manual.km}
              onChange={(e) => setManual((m) => ({ ...m, km: e.target.value }))}
              className="dg-well mt-1 w-full px-3 py-2 font-num text-xl text-white"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs text-steel-400">분</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={720}
                value={manual.min}
                onChange={(e) => setManual((m) => ({ ...m, min: e.target.value }))}
                className="dg-well mt-1 w-full px-3 py-2 font-num text-xl text-white"
              />
            </label>
            <label className="block">
              <span className="text-xs text-steel-400">초</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                value={manual.sec}
                onChange={(e) => setManual((m) => ({ ...m, sec: e.target.value }))}
                className="dg-well mt-1 w-full px-3 py-2 font-num text-xl text-white"
              />
            </label>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={checkAttendance} onChange={(e) => setCheckAttendance(e.target.checked)} className="h-5 w-5" />
            오늘 출석도 체크하기(아직 안 했을 때)
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setManualOpen(false)} disabled={saving} className="dg-btn dg-btn-steel min-h-[44px] flex-1">
              닫기
            </button>
            <button type="submit" disabled={saving} className="dg-btn dg-btn-primary min-h-[44px] flex-1">
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </DialogFrame>
    </section>
  );
}
