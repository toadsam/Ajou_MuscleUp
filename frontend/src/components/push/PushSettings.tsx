import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast";
import { friendlyError } from "../../lib/httpError";
import { currentSubscription, disablePush, enablePush, pushSupport, type PushMe, type PushPreferences } from "../../lib/push";

// 마이페이지 "알림" 칸. 이 기기 알림 켜기 · 끄기, 종류별 켜기, 시험 알림.
// 규칙: 하루 2개까지, 밤 10시 ~ 아침 8시엔 보내지 않음(서버가 지킨다).

const KINDS: { key: keyof PushPreferences; label: string; hint: string }[] = [
  { key: "reminder", label: "저녁 출석 알림", hint: "저녁 7시, 오늘 아직 출석 안 했을 때" },
  { key: "weekly", label: "주간 목표 알림", hint: "토 · 일 저녁 6시, 이번 주 목표가 남았을 때" },
  { key: "social", label: "응원 · 댓글", hint: "누군가 내 출석을 응원하거나 자랑에 댓글을 달면" },
];

export default function PushSettings() {
  const support = pushSupport();
  const [me, setMe] = useState<PushMe | null>(null);
  const [onThisDevice, setOnThisDevice] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [meRes, sub] = await Promise.all([api.get<PushMe>("/api/push/me"), currentSubscription().catch(() => null)]);
      setMe(meRes.data);
      setOnThisDevice(Boolean(sub) && meRes.data.devices > 0);
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const turnOn = async () => {
    setBusy(true);
    try {
      setMe(await enablePush());
      setOnThisDevice(true);
      toast("이 기기에서 알림을 켰어요.", "success");
    } catch (e: unknown) {
      toast(e instanceof Error && !("response" in e) ? e.message : friendlyError(e, "알림을 켜지 못했어요."), "error");
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      const res = await disablePush();
      if (res) setMe(res);
      setOnThisDevice(false);
      toast("이 기기 알림을 껐어요.", "success");
    } catch (e: unknown) {
      toast(friendlyError(e, "알림을 끄지 못했어요."), "error");
    } finally {
      setBusy(false);
    }
  };

  const setKind = async (key: keyof PushPreferences, value: boolean) => {
    if (!me) return;
    const next = { ...me.preferences, [key]: value };
    setMe({ ...me, preferences: next });
    try {
      setMe((await api.put<PushMe>("/api/push/preferences", next)).data);
    } catch (e: unknown) {
      toast(friendlyError(e, "바꾸지 못했어요."), "error");
      void load();
    }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ delivered: number }>("/api/push/test");
      toast(res.data.delivered > 0 ? "시험 알림을 보냈어요. 곧 도착해요." : "보낼 기기가 없어요. 알림을 다시 켜 주세요.", res.data.delivered > 0 ? "success" : "error");
    } catch (e: unknown) {
      toast(friendlyError(e, "시험 알림을 보내지 못했어요."), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dg-steel space-y-3 p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl">알림</h3>
          <p className="text-xs text-steel-400">하루 2개까지만, 밤 10시 ~ 아침 8시엔 보내지 않아요.</p>
        </div>
        {support === "ok" && me?.enabled && (
          <button
            type="button"
            onClick={() => void (onThisDevice ? turnOff() : turnOn())}
            disabled={busy}
            aria-pressed={onThisDevice}
            className={`dg-btn min-h-[44px] flex-none px-4 text-sm ${onThisDevice ? "dg-btn-steel" : "dg-btn-primary"}`}
          >
            {onThisDevice ? "이 기기 알림 끄기" : "알림 켜기"}
          </button>
        )}
      </div>

      {support === "ios-needs-install" && (
        <p className="dg-well p-3 text-sm text-steel-300">
          아이폰은 Safari 공유 버튼 → "홈 화면에 추가"로 앱을 설치한 뒤, 설치한 앱에서 알림을 켤 수 있어요(iOS 16.4 이상).
        </p>
      )}
      {support === "unsupported" && <p className="dg-well p-3 text-sm text-steel-300">이 브라우저는 웹 알림을 지원하지 않아요.</p>}
      {support === "denied" && (
        <p className="dg-well p-3 text-sm text-steel-300">알림이 차단되어 있어요. 브라우저 설정에서 이 사이트 알림을 허용해 주세요.</p>
      )}
      {me && !me.enabled && support === "ok" && <p className="dg-well p-3 text-sm text-steel-300">알림을 준비하고 있어요.</p>}

      {me && me.devices > 0 && (
        <>
          <ul className="space-y-2">
            {KINDS.map((k) => (
              <li key={k.key}>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    <span className="block font-semibold">{k.label}</span>
                    <span className="block text-xs text-steel-400">{k.hint}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={me.preferences[k.key]}
                    onChange={(e) => void setKind(k.key, e.target.checked)}
                    className="h-5 w-5 flex-none"
                  />
                </label>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-2 text-xs text-steel-400">
            <span>
              알림 받는 기기 {me.devices}대 · 오늘 {me.sentToday}/{me.dailyCap}
            </span>
            {onThisDevice && (
              <button type="button" onClick={() => void sendTest()} disabled={busy} className="dg-btn dg-btn-steel min-h-[36px] px-3 text-xs">
                시험 알림 보내기
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
