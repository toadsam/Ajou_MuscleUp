import { useEffect, useState } from "react";
import type { CharacterTier } from "./types";

type Props = {
  active: boolean;
  tier: CharacterTier;
  children: React.ReactNode;
};

const isMasterOrHigher = (tier: CharacterTier) =>
  tier === "MASTER" || tier === "GRANDMASTER" || tier === "CHALLENGER";

export default function TierUpAnimation({ active, tier, children }: Props) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!active) return;
    setPlaying(true);
    const timer = window.setTimeout(() => setPlaying(false), 900);
    return () => window.clearTimeout(timer);
  }, [active, tier]);

  const burstClass = playing && isMasterOrHigher(tier) ? "tierup-master-screen-burst" : "";
  const scaleClass = playing ? "tierup-pop-scale" : "";

  return <div className={`${burstClass} ${scaleClass}`}>{children}</div>;
}
