import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DungeonView from "../components/boss/DungeonView";
import type { StageCharacter } from "../components/workout/LiftStage";
import { api } from "../lib/api";
import { friendlyError } from "../lib/httpError";
import { SHADOW_ENTER_PATH, SHADOW_STRIKE_PATH, type ShadowGrade, type ShadowHit, type ShadowSkill, type ShadowStatus } from "../lib/shadow";

// 그림자 던전(/shadow/dungeon, docs/design/shadow-dungeon.md 5.2) — 전체 화면. 들어오면 enter(횟수) → 상태, 기술마다 strike.

export default function ShadowDungeon() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ShadowStatus | null>(null);
  const [character, setCharacter] = useState<StageCharacter | null>(null);
  const [mbti, setMbti] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      api.post<ShadowStatus>(SHADOW_ENTER_PATH),
      api.get<StageCharacter>("/api/character/me").catch(() => null),
      api.get<{ mbti?: string | null }>("/api/mypage/stats").catch(() => null),
    ])
      .then(([s, c, st]) => {
        if (!alive) return;
        setStatus(s.data);
        setCharacter(c?.data ?? null);
        setMbti(st?.data?.mbti ?? null);
      })
      .catch((e: unknown) => alive && setError(friendlyError(e, "던전 문이 안 열려요. 잠시 뒤 다시 와 주세요.")));
    return () => {
      alive = false;
    };
  }, []);

  const strike = (skill: ShadowSkill, grade: ShadowGrade, crit: boolean) =>
    api.post<ShadowHit>(SHADOW_STRIKE_PATH, { skill, grade, crit }).then((r) => r.data);

  const exit = () => navigate("/shadow");

  if (error) {
    return (
      <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-steel-950 px-6 text-center text-white">
        <p className="text-sm text-steel-300">{error}</p>
        <button type="button" className="dg-btn dg-btn-steel min-h-[40px] px-4 text-sm" onClick={exit}>
          돌아가기
        </button>
      </div>
    );
  }
  if (!status) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-steel-950 text-sm text-steel-400">
        <span className="dg-loading-plates mr-3" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
        던전 문을 여는 중
      </div>
    );
  }
  return <DungeonView status={status} character={character} mbti={mbti} strike={strike} onExit={exit} />;
}
