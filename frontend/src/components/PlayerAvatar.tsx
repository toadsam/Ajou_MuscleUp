import AvatarRenderer from "./avatar/AvatarRenderer";
import type { CharacterTier, GrowthParams } from "./avatar/types";
import { defaultGrowthParams } from "./avatar/types";

type PlayerAvatarProps = {
  nickname: string;
  level: number;
  tier: CharacterTier;
  evolutionStage: number;
  avatarSeed?: string;
  growthParams?: GrowthParams;
  mbti?: string;
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

const fallbackSeed = (nickname: string) => {
  let h = 0;
  for (let i = 0; i < nickname.length; i += 1) h = (h * 31 + nickname.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0").repeat(4).slice(0, 32);
};

export default function PlayerAvatar({
  nickname,
  level,
  tier,
  evolutionStage,
  avatarSeed,
  growthParams,
  mbti,
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
        <AvatarRenderer
          avatarSeed={avatarSeed ?? fallbackSeed(nickname)}
          growthParams={growthParams ?? defaultGrowthParams}
          tier={tier}
          stage={evolutionStage}
          mbti={mbti}
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
