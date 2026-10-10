import AvatarRenderer from "./avatar/AvatarRenderer";
import type { CharacterTier, GrowthParams } from "./avatar/types";
import { defaultGrowthParams } from "./avatar/types";

type PlayerAvatarProps = {
  nickname: string;
  level: number;
  tier: CharacterTier;
  evolutionStage: number;
  avatarSeed?: string;
  gender?: "MALE" | "FEMALE";
  growthParams?: GrowthParams;
  mbti?: string;
  isResting?: boolean;
  facing?: "left" | "right";
  isMe?: boolean;
};

const tierStyles: Record<CharacterTier, { badge: string }> = {
  BRONZE: { badge: "bg-orange-300 text-black" },
  SILVER: { badge: "bg-steel-300 text-black" },
  GOLD: { badge: "bg-plate-yellow text-black" },
  PLATINUM: { badge: "bg-steel-100 text-black" },
  DIAMOND: { badge: "bg-plate-blue text-white" },
  MASTER: { badge: "bg-plate-green text-white" },
  GRANDMASTER: { badge: "bg-plate-red text-white" },
  CHALLENGER: { badge: "bg-black text-plate-yellow" },
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
  gender,
  growthParams,
  mbti,
  isResting = false,
  facing = "right",
  isMe = false,
}: PlayerAvatarProps) {
  const styles = tierStyles[tier];

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        style={{ transform: facing === "left" ? "scaleX(-1)" : "scaleX(1)" }}
      >
        <AvatarRenderer
          avatarSeed={avatarSeed ?? fallbackSeed(nickname)}
          growthParams={growthParams ?? defaultGrowthParams}
          tier={tier}
          stage={evolutionStage}
          gender={gender}
          mbti={mbti}
          isResting={isResting}
          size={76}
        />
      </div>
      <div
        className={`max-w-[96px] truncate text-[11px] font-semibold ${isMe ? "rounded border-2 border-black bg-plate-yellow px-1.5 text-black" : "text-chalk"}`}
      >
        {nickname}
      </div>
      <div className={`rounded border-2 border-black px-1.5 py-[1px] font-num text-[11px] leading-tight tracking-wide shadow-sm ${styles.badge}`}>
        Lv.{level} {tier}
      </div>
    </div>
  );
}
