export type SeededFeatures = {
  faceShape: number;
  eyeStyle: number;
  hairStyle: number;
  baseBuild: number;
  jawWidth: number;
  cheekDepth: number;
  eyeSpacing: number;
  browTilt: number;
  noseHeight: number;
  mouthWidth: number;
  hairVolume: number;
  earSize: number;
  neckWidth: number;
  limbLength: number;
};

const hashToInt = (input: string) => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
};

const pick = (seed: string, salt: string, size: number) =>
  hashToInt(`${seed}:${salt}`) % size;

const pickFloat = (seed: string, salt: string, min: number, max: number) => {
  const raw = hashToInt(`${seed}:${salt}:float`) / 4294967295;
  return min + (max - min) * raw;
};

export const resolveSeedFeatures = (avatarSeed: string): SeededFeatures => ({
  faceShape: pick(avatarSeed, "face", 7),
  eyeStyle: pick(avatarSeed, "eye", 9),
  hairStyle: pick(avatarSeed, "hair", 10),
  baseBuild: pick(avatarSeed, "build", 6),
  jawWidth: pickFloat(avatarSeed, "jaw-width", 0.85, 1.25),
  cheekDepth: pickFloat(avatarSeed, "cheek-depth", 0.8, 1.22),
  eyeSpacing: pickFloat(avatarSeed, "eye-spacing", 0.82, 1.2),
  browTilt: pickFloat(avatarSeed, "brow-tilt", -8, 8),
  noseHeight: pickFloat(avatarSeed, "nose-height", 0.85, 1.25),
  mouthWidth: pickFloat(avatarSeed, "mouth-width", 0.8, 1.28),
  hairVolume: pickFloat(avatarSeed, "hair-volume", 0.8, 1.4),
  earSize: pickFloat(avatarSeed, "ear-size", 0.8, 1.3),
  neckWidth: pickFloat(avatarSeed, "neck-width", 0.82, 1.24),
  limbLength: pickFloat(avatarSeed, "limb-length", 0.86, 1.24),
});
