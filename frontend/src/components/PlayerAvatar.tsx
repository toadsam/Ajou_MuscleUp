import CharacterAvatar from "./CharacterAvatar";

type CharacterTier =
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "DIAMOND"
  | "MASTER"
  | "GRANDMASTER"
  | "CHALLENGER";

type Gender = "MALE" | "FEMALE";

type PlayerAvatarProps = {
  nickname: string;
  level: number;
  tier: CharacterTier;
  evolutionStage: number;
  gender?: Gender | null;
  facing?: "left" | "right";
  isMe?: boolean;
};

const tierStyles: Record<CharacterTier, { badge: string }> = {
  BRONZE: { badge: "bg-amber-500/80 text-black" },
  SILVER: { badge: "bg-slate-200 text-slate-900" },
  GOLD: { badge: "bg-yellow-300 text-black" },
  PLATINUM: { badge: "bg-cyan-300 text-slate-900" },
  DIAMOND: { badge: "bg-sky-200 text-slate-900" },
  MASTER: { badge: "bg-emerald-300 text-black" },
  GRANDMASTER: { badge: "bg-orange-300 text-black" },
  CHALLENGER: { badge: "bg-rose-300 text-black" },
};

export default function PlayerAvatar({
  nickname,
  level,
  tier,
  evolutionStage,
  gender,
  facing = "right",
  isMe = false,
}: PlayerAvatarProps) {
  const styles = tierStyles[tier];

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={isMe ? "drop-shadow-[0_0_14px_rgba(16,185,129,0.7)]" : ""}
        style={{ transform: facing === "left" ? "scaleX(-1)" : "scaleX(1)" }}
      >
        <CharacterAvatar
          tier={tier}
          stage={evolutionStage}
          level={level}
          gender={gender ?? undefined}
          size={76}
        />
      </div>
      <div className="text-[11px] text-white/90 font-semibold">{nickname}</div>
      <div className={`px-2 py-[2px] rounded-full text-[10px] ${styles.badge}`}>
        Lv.{level} {tier}
      </div>
    </div>
  );
}
