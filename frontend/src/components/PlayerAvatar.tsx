type CharacterTier =
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "DIAMOND"
  | "MASTER"
  | "GRANDMASTER"
  | "CHALLENGER";

type PlayerAvatarProps = {
  nickname: string;
  level: number;
  tier: CharacterTier;
  isMe?: boolean;
};

const tierStyles: Record<CharacterTier, { ring: string; badge: string }> = {
  BRONZE: { ring: "ring-amber-400/60", badge: "bg-amber-500/80 text-black" },
  SILVER: { ring: "ring-slate-300/70", badge: "bg-slate-200 text-slate-900" },
  GOLD: { ring: "ring-yellow-300/70", badge: "bg-yellow-300 text-black" },
  PLATINUM: { ring: "ring-cyan-300/70", badge: "bg-cyan-300 text-slate-900" },
  DIAMOND: { ring: "ring-sky-300/80", badge: "bg-sky-200 text-slate-900" },
  MASTER: { ring: "ring-emerald-300/80", badge: "bg-emerald-300 text-black" },
  GRANDMASTER: { ring: "ring-orange-300/80", badge: "bg-orange-300 text-black" },
  CHALLENGER: { ring: "ring-rose-300/80", badge: "bg-rose-300 text-black" },
};

export default function PlayerAvatar({
  nickname,
  level,
  tier,
  isMe = false,
}: PlayerAvatarProps) {
  const styles = tierStyles[tier];

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`h-10 w-10 rounded-full bg-white/15 ring-2 ${styles.ring} ${
          isMe ? "ring-offset-2 ring-offset-emerald-400/60" : ""
        }`}
      />
      <div className="text-[11px] text-white/90 font-semibold">{nickname}</div>
      <div className={`px-2 py-[2px] rounded-full text-[10px] ${styles.badge}`}>
        Lv.{level} {tier}
      </div>
    </div>
  );
}
