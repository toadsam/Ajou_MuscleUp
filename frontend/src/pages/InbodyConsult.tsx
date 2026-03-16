import { useState } from "react";
import type { FormEvent } from "react";

const API_BASE = import.meta.env.VITE_API_BASE;

type InbodyResponse = {
  consultation: string;
  metrics: Record<string, string>;
  confidence: number;
  reviewRequired: boolean;
  warnings: string[];
  sourceType: string;
};

const metricLabels: Record<string, string> = {
  height_cm: "키 (cm)",
  weight_kg: "체중 (kg)",
  skeletal_muscle_kg: "골격근량 (kg)",
  body_fat_kg: "체지방량 (kg)",
  body_fat_percent: "체지방률 (%)",
  bmi: "BMI",
  bmr_kcal: "기초대사량 (kcal)",
  visceral_fat_level: "내장지방 레벨",
  inbody_score: "인바디 점수",
};

export default function InbodyConsult() {
  const [file, setFile] = useState<File | null>(null);
  const [goal, setGoal] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InbodyResponse | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("인바디 사진 또는 PDF 파일을 선택해 주세요.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    if (goal.trim()) formData.append("goal", goal.trim());
    if (notes.trim()) formData.append("notes", notes.trim());

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/ai/inbody/consult`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error((await res.text()) || `HTTP ${res.status}`);
      }
      const data: InbodyResponse = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err?.message ?? "분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const exportToPdf = () => {
    if (!result) return;
    const popup = window.open("", "_blank", "width=900,height=1200");
    if (!popup) {
      setError("팝업이 차단되어 PDF 내보내기를 시작할 수 없습니다.");
      return;
    }

    const now = new Date();
    const dateText = now.toLocaleString("ko-KR");
    const metricRows = Object.entries(metricLabels)
      .map(([key, label]) => `<tr><td>${label}</td><td>${escapeHtml(result.metrics?.[key] || "-")}</td></tr>`)
      .join("");
    const warningRows = (result.warnings || [])
      .map((warning) => `<li>${escapeHtml(warning)}</li>`)
      .join("");
    const consultation = escapeHtml(result.consultation || "-").replace(/\n/g, "<br/>");

    popup.document.write(`
      <!doctype html>
      <html lang="ko">
        <head>
          <meta charset="utf-8" />
          <title>인바디 AI 상담 리포트</title>
          <style>
            body { font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; margin: 28px; color: #111; }
            h1 { margin: 0 0 8px; font-size: 24px; }
            h2 { margin: 20px 0 10px; font-size: 18px; }
            .meta { color: #444; font-size: 12px; margin-bottom: 14px; }
            .badge { display: inline-block; margin-right: 6px; padding: 4px 8px; border: 1px solid #888; border-radius: 999px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            td { border: 1px solid #d4d4d4; padding: 8px; }
            td:first-child { width: 42%; background: #fafafa; font-weight: 600; }
            ul { margin: 6px 0 0 18px; padding: 0; }
            .consult { border: 1px solid #d4d4d4; padding: 12px; line-height: 1.55; font-size: 13px; white-space: normal; }
            .note { margin-top: 10px; font-size: 11px; color: #666; }
            @media print { body { margin: 16px; } }
          </style>
        </head>
        <body>
          <h1>인바디 AI 상담 리포트</h1>
          <div class="meta">생성 시각: ${dateText}</div>
          <div>
            <span class="badge">신뢰도 ${result.confidence}%</span>
            <span class="badge">입력 형식 ${escapeHtml(result.sourceType)}</span>
            ${result.reviewRequired ? '<span class="badge">수치 확인 필요</span>' : ""}
          </div>

          <h2>추출 수치</h2>
          <table>
            <tbody>${metricRows}</tbody>
          </table>

          ${
            warningRows
              ? `<h2>검토 알림</h2><ul>${warningRows}</ul>`
              : ""
          }

          <h2>AI 상담 결과</h2>
          <div class="consult">${consultation}</div>
          <div class="note">본 문서는 의료 진단이 아닌 운동/영양 코칭 참고 자료입니다.</div>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  return (
    <section className="min-h-screen bg-slate-950 px-6 pb-16 pt-28 text-slate-100 lg:px-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">인바디 AI 상담</h1>
          <p className="mt-2 text-sm text-slate-300">
            인바디 결과지 사진 또는 PDF를 올리면 수치 추출과 맞춤 상담을 제공합니다.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <label className="block text-sm">
            인바디 파일 (이미지/PDF)
            <input
              type="file"
              accept="image/*,.pdf,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            목표
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="예: 체지방 감량 + 하체 근력 강화"
              className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            추가 메모
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="예: 주 3회 운동 가능, 무릎 통증 이력 있음"
              className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-60"
          >
            {loading ? "AI 분석 중..." : "인바디 상담 시작"}
          </button>
          <p className="text-xs text-slate-400">의료 진단이 아닌 운동/영양 코칭 참고 정보입니다.</p>
        </form>

        {error && <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}

        {result && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-semibold">추출 결과</h2>
                <span className="rounded-full border border-slate-600 px-3 py-1 text-xs">
                  신뢰도 {result.confidence}%
                </span>
                <span className="rounded-full border border-slate-600 px-3 py-1 text-xs">
                  입력 형식: {result.sourceType}
                </span>
                {result.reviewRequired && (
                  <span className="rounded-full border border-amber-400 px-3 py-1 text-xs text-amber-200">
                    수치 확인 필요
                  </span>
                )}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(metricLabels).map(([key, label]) => (
                  <div key={key} className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="mt-1 text-base font-semibold">{result.metrics?.[key] || "-"}</p>
                  </div>
                ))}
              </div>
            </div>

            {result.warnings?.length > 0 && (
              <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-6">
                <h3 className="font-semibold text-amber-200">검토 알림</h3>
                <ul className="mt-2 list-disc pl-5 text-sm text-amber-100">
                  {result.warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-semibold">AI 상담 결과</h3>
                <button
                  type="button"
                  onClick={exportToPdf}
                  className="rounded-lg border border-slate-500 px-3 py-2 text-xs font-semibold hover:bg-slate-800"
                >
                  PDF로 내보내기
                </button>
              </div>
              <pre className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{result.consultation}</pre>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

const escapeHtml = (raw: string) =>
  raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
