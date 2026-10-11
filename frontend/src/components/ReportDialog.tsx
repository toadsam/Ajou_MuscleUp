import { useId, useState } from "react";
import DialogFrame from "./DialogFrame";
import { api } from "../lib/api";
import { toast } from "../lib/toast";
import { errorStatus, friendlyError } from "../lib/httpError";
import { REPORT_DETAIL_MAX, REPORT_REASONS, type ReportReason, type ReportTargetType } from "../lib/reportLabels";

// 글 · 댓글 · 공동구매 · 사용자 신고 창. 운영진이 관리자 화면 "신고" 탭에서 확인한다.

type Props = {
  targetType: ReportTargetType;
  targetId: number;
  open: boolean;
  onClose: () => void;
  /** 창 제목에 쓰는 대상 이름. 예: "이 글", "이 댓글" */
  subjectLabel?: string;
};

const DEFAULT_SUBJECT: Record<ReportTargetType, string> = {
  BRAG_POST: "이 글",
  BRAG_COMMENT: "이 댓글",
  PROTEIN: "이 공동구매",
  USER: "이 사람",
};

export default function ReportDialog(props: Props) {
  // 닫혀 있을 땐 그리지 않는다 → 다시 열 때마다 빈 상태로 시작
  if (!props.open) return null;
  return <ReportForm key={`${props.targetType}-${props.targetId}`} {...props} />;
}

function ReportForm({ targetType, targetId, onClose, subjectLabel }: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groupName = useId();
  const detailId = useId();
  const counterId = useId();

  const subject = subjectLabel || DEFAULT_SUBJECT[targetType];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reason || sending) return;
    setSending(true);
    setError(null);
    try {
      await api.post("/api/reports", {
        targetType,
        targetId,
        reason,
        detail: detail.trim() ? detail.trim().slice(0, REPORT_DETAIL_MAX) : undefined,
      });
      toast("신고했어요. 운영진이 확인할게요.", "success");
      onClose();
    } catch (e) {
      const message = friendlyError(e, "신고를 보내지 못했어요. 잠시 뒤에 다시 시도해 주세요.");
      // 이미 신고한 대상이면 창을 닫고 알려 준다
      if (errorStatus(e) === 409) {
        toast(message, "info");
        onClose();
        return;
      }
      setError(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <DialogFrame
      open
      onClose={onClose}
      busy={sending}
      title={`${subject} 신고하기`}
      description="어떤 문제인지 골라 주세요. 신고한 사람은 상대에게 알려지지 않아요."
    >
      <form onSubmit={submit} className="space-y-4">
        <fieldset>
          <legend className="sr-only">신고 이유</legend>
          <div className="grid gap-2">
            {REPORT_REASONS.map(([value, label]) => {
              const checked = reason === value;
              return (
                <label
                  key={value}
                  className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border-2 px-3 py-2 text-sm font-semibold transition-colors ${
                    checked ? "border-plate-yellow bg-steel-700 text-chalk" : "border-black bg-steel-900 text-steel-200 hover:bg-steel-800"
                  }`}
                >
                  <input
                    type="radio"
                    name={groupName}
                    value={value}
                    checked={checked}
                    onChange={() => setReason(value)}
                    className="h-4 w-4 flex-none accent-plate-red"
                  />
                  {label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="space-y-1.5">
          <label htmlFor={detailId} className="block text-sm font-semibold text-steel-200">
            더 알려 줄 내용 <span className="font-normal text-steel-400">(선택)</span>
          </label>
          <textarea
            id={detailId}
            value={detail}
            maxLength={REPORT_DETAIL_MAX}
            onChange={(e) => setDetail(e.target.value.slice(0, REPORT_DETAIL_MAX))}
            rows={3}
            aria-describedby={counterId}
            placeholder="어떤 부분이 문제인지 적어 주면 확인이 빨라져요."
            className="dg-well w-full resize-none px-3 py-2 text-sm text-white placeholder:text-steel-500 focus:border-plate-yellow focus:outline focus:outline-[3px] focus:outline-plate-yellow"
          />
          <p id={counterId} className="text-right font-num text-xs font-bold text-steel-400">
            {detail.length}/{REPORT_DETAIL_MAX}
          </p>
        </div>

        {error && (
          <p role="alert" className="dg-well border-l-4 border-l-plate-red px-3 py-2 text-sm font-semibold text-red-200">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={sending} className="dg-btn dg-btn-steel min-h-[42px] px-4 text-sm">
            취소
          </button>
          <button type="submit" disabled={!reason || sending} className="dg-btn dg-btn-primary min-h-[42px] px-4 text-sm">
            {sending ? "보내는 중" : "신고하기"}
          </button>
        </div>
      </form>
    </DialogFrame>
  );
}
