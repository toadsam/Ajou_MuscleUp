import { useCallback, useEffect, useId, useState } from "react";
import DialogFrame from "./DialogFrame";
import { api } from "../lib/api";
import { toast } from "../lib/toast";
import { friendlyError } from "../lib/httpError";
import { setCurrentGym } from "../lib/currentGym";
import { clearSupportChat } from "../lib/supportChatStorage";

// 마이페이지 아래쪽 "차단한 사람" · "회원 탈퇴" 칸.

type BlockedUser = { userId: number; nickname?: string | null };

export function BlockedUsersSection() {
  const [items, setItems] = useState<BlockedUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<BlockedUser[]>("/api/blocks");
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(friendlyError(e, "차단 목록을 불러오지 못했어요."));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unblock = async (user: BlockedUser) => {
    if (busyId !== null) return;
    setBusyId(user.userId);
    try {
      await api.delete(`/api/blocks/${user.userId}`);
      setItems((prev) => (prev ? prev.filter((u) => u.userId !== user.userId) : prev));
      toast(`${user.nickname || "회원"}님 차단을 풀었어요.`, "success");
    } catch (e) {
      toast(friendlyError(e, "차단을 풀지 못했어요."), "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="dg-steel space-y-3 p-5" aria-labelledby="blocked-users-title">
      <div>
        <h2 id="blocked-users-title" className="font-display text-xl">
          차단한 사람
        </h2>
        <p className="mt-1 text-sm text-steel-400">차단한 사람과는 서로의 자랑방 글 · 댓글이 보이지 않아요.</p>
      </div>

      {error ? (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert" className="text-sm font-semibold text-red-300">
            {error}
          </p>
          <button type="button" onClick={() => void load()} className="dg-btn dg-btn-steel min-h-[36px] px-3 text-xs">
            다시 시도
          </button>
        </div>
      ) : items === null ? (
        <p className="text-sm text-steel-400" role="status">
          불러오는 중이에요.
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-steel-400">차단한 사람이 없어요.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((user) => (
            <li key={user.userId} className="dg-well flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0 truncate font-semibold text-chalk">{user.nickname || "알 수 없는 회원"}</span>
              <button
                type="button"
                onClick={() => void unblock(user)}
                disabled={busyId !== null}
                className="dg-btn dg-btn-steel min-h-[36px] flex-none px-3 text-xs"
              >
                {busyId === user.userId ? "푸는 중" : "차단 풀기"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const CONFIRM_WORD = "탈퇴";

export function WithdrawSection() {
  const [open, setOpen] = useState(false);

  return (
    <section className="space-y-2 border-t-2 border-steel-800 pt-6" aria-labelledby="withdraw-title">
      <h2 id="withdraw-title" className="text-base font-bold text-steel-300">
        회원 탈퇴
      </h2>
      <p className="text-sm text-steel-400">탈퇴하면 기록과 캐릭터가 지워지고 되돌릴 수 없어요.</p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-semibold text-steel-400 underline underline-offset-4 hover:text-red-300"
      >
        탈퇴 안내 보기
      </button>
      {open && <WithdrawDialog onClose={() => setOpen(false)} />}
    </section>
  );
}

function WithdrawDialog({ onClose }: { onClose: () => void }) {
  const [typed, setTyped] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const ready = typed.trim() === CONFIRM_WORD;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready || sending) return;
    setSending(true);
    setError(null);
    try {
      await api.post("/api/auth/withdraw", { confirm: CONFIRM_WORD });
      // 로그아웃과 같은 정리: 이 기기에 남은 계정 흔적을 지운다
      localStorage.removeItem("user");
      setCurrentGym(null);
      clearSupportChat();
      toast("탈퇴했어요. 그동안 함께해 줘서 고마워요.", "success");
      window.setTimeout(() => {
        window.location.href = "/";
      }, 900);
    } catch (e) {
      setError(friendlyError(e, "탈퇴를 처리하지 못했어요. 잠시 뒤에 다시 시도해 주세요."));
      setSending(false);
    }
  };

  return (
    <DialogFrame open onClose={onClose} busy={sending} tone="danger" title="정말 탈퇴할까요?" description="탈퇴하면 되돌릴 수 없어요. 아래 내용을 확인해 주세요.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-sm font-bold text-chalk">지워지는 것</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-steel-300">
            <li>캐릭터 · 출석 기록 · AI 상담 기록</li>
            <li>자랑방 글 · 댓글 · 응원</li>
            <li>친구와 1:1 대화</li>
            <li>모임 가입, 공동구매 참여 · 대화, 후기</li>
            <li>로그인 연결(구글 · 카카오 등)</li>
          </ul>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-bold text-chalk">남는 것</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-steel-300">
            <li>내가 연 공동구매 모집글은 "탈퇴한 회원" 이름으로 남아요.</li>
            <li>내가 만든 모임은 운영진(없으면 가장 오래된 멤버)에게 넘어가요. 다른 멤버가 없으면 닫혀요.</li>
            <li>올린 사진 · 영상 파일은 저장소에서 바로 지워지지 않을 수 있어요.</li>
          </ul>
        </div>

        <div className="space-y-1.5">
          <label htmlFor={inputId} className="block text-sm font-semibold text-steel-200">
            계속하려면 <span className="font-bold text-chalk">{CONFIRM_WORD}</span> 라고 입력해 주세요.
          </label>
          <input
            id={inputId}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="dg-well w-full px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow"
            placeholder={CONFIRM_WORD}
          />
        </div>

        {error && (
          <p role="alert" className="dg-well border-l-4 border-l-plate-red px-3 py-2 text-sm font-semibold text-red-200">
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} disabled={sending} className="dg-btn dg-btn-steel min-h-[42px] px-4 text-sm">
            취소
          </button>
          <button type="submit" disabled={!ready || sending} className="dg-btn dg-btn-primary min-h-[42px] px-4 text-sm">
            {sending ? "탈퇴하는 중" : "탈퇴하기"}
          </button>
        </div>
      </form>
    </DialogFrame>
  );
}
