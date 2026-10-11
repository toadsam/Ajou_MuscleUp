import { useEffect, useState } from "react";
import { httpError, friendlyError } from "../lib/httpError";
import { toast } from "../lib/toast";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

// 동아리 멤버 명단(실명)은 서버에만 있다. 로그인한 회원만 받을 수 있다(/api/club/roster).
// 예전에는 이 파일에 배열로 적혀 있어 누구나 사이트 JS 파일로 볼 수 있었다.
// 명단은 운영진(관리자)이 이 화면의 "명단 고치기"에서 한 줄에 한 명씩 붙여 넣어 바꾼다.

const readIsAdmin = () => {
  try {
    const raw = localStorage.getItem("user");
    const role = raw ? String((JSON.parse(raw) as { role?: string }).role ?? "") : "";
    return role.toUpperCase().includes("ADMIN");
  } catch {
    return false;
  }
};

export default function Members() {
  const [names, setNames] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin] = useState(readIsAdmin);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/club/roster`, { credentials: "include" });
      if (!res.ok) throw await httpError(res, "명단을 불러오지 못했어요. 잠시 뒤에 다시 시도해 주세요.");
      const data = (await res.json()) as { names?: string[] };
      setNames(data.names ?? []);
    } catch (e) {
      setError(friendlyError(e, "명단을 불러오지 못했어요. 잠시 뒤에 다시 시도해 주세요."));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const startEdit = () => {
    setDraft((names ?? []).join("\n"));
    setEditing(true);
  };

  const save = async () => {
    try {
      setSaving(true);
      const list = draft.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const res = await fetch(`${API_BASE}/api/admin/club/roster`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names: list }),
      });
      if (!res.ok) throw await httpError(res, "명단을 저장하지 못했어요.");
      const data = (await res.json()) as { names?: string[] };
      setNames(data.names ?? []);
      setEditing(false);
      toast(`명단을 저장했어요 · ${data.names?.length ?? 0}명`, "success");
    } catch (e) {
      toast(friendlyError(e, "명단을 저장하지 못했어요."), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="relative min-h-screen overflow-hidden px-6 pb-20 pt-28 text-white lg:px-10">
      <div className="relative mx-auto max-w-6xl space-y-8">
        <header className="dg-steel relative overflow-hidden p-6 md:p-8">
          <p className="font-num text-sm font-bold text-plate-green">Members</p>
          <h1 className="mt-2 text-3xl md:text-5xl">멤버 소개</h1>
          <p className="mt-3 max-w-3xl break-keep text-sm text-steel-300 md:text-base">
            {names
              ? `득근득근에서 함께 운동하는 멤버 ${names.length}명이에요. 회원끼리만 볼 수 있어요.`
              : "득근득근에서 함께 운동하는 멤버예요. 회원끼리만 볼 수 있어요."}
          </p>
          {isAdmin && !editing && names && (
            <button type="button" className="dg-btn dg-btn-steel mt-4" onClick={startEdit}>
              명단 고치기
            </button>
          )}
        </header>

        {isAdmin && editing && (
          <div className="dg-steel space-y-3 p-5">
            <label htmlFor="roster" className="block text-sm font-bold">
              한 줄에 한 명씩 적어 주세요. 빈 줄 · 같은 이름은 저장할 때 정리돼요.
            </label>
            <textarea
              id="roster"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={12}
              className="w-full rounded-md border-2 border-black bg-steel-900 px-4 py-3 text-base text-chalk focus:outline-none focus-visible:border-plate-yellow"
            />
            <div className="flex gap-2">
              <button type="button" className="dg-btn dg-btn-primary" onClick={save} disabled={saving}>
                {saving ? "저장 중…" : "저장"}
              </button>
              <button type="button" className="dg-btn dg-btn-steel" onClick={() => setEditing(false)} disabled={saving}>
                취소
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="dg-steel flex flex-wrap items-center gap-3 p-5 text-sm text-steel-300">
            <span>{error}</span>
            <button type="button" className="dg-btn dg-btn-steel" onClick={() => void load()}>
              다시 시도
            </button>
          </div>
        )}

        {!error && names === null && (
          <div className="flex flex-col items-center gap-3 py-10 text-sm text-steel-400" role="status">
            <span className="dg-loading-plates" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span>불러오는 중</span>
          </div>
        )}

        {names && names.length === 0 && (
          <p className="dg-steel p-5 text-sm text-steel-300">
            {isAdmin ? "아직 명단이 없어요. \"명단 고치기\"에서 붙여 넣어 주세요." : "운영진이 아직 명단을 올리지 않았어요."}
          </p>
        )}

        {names && names.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {names.map((name, idx) => (
              <li
                key={`${name}-${idx}`}
                className="dg-rise flex items-center gap-3 rounded-lg border-[3px] border-black bg-steel-800 px-4 py-3 shadow-md"
                style={{ animationDelay: `${Math.min(idx, 12) * 30}ms` }}
              >
                <span className="font-num text-sm font-bold text-steel-500">{String(idx + 1).padStart(2, "0")}</span>
                <span className="font-display text-lg">{name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
