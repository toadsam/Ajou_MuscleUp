import type { CharacterTier } from "./types";

export type TierPreset = {
  glow: number;
  strokeBoost: number;
  auraRings: number;
  auraGradient: boolean;
  particles: number;
  pulse: boolean;
  floorShadow: boolean;
  lightWave: boolean;
  sigil: boolean;
  energyRing: boolean;
  burst: boolean;
  auraIntensity: number;
};

export const TIER_PRESETS: Record<CharacterTier, TierPreset> = {
  BRONZE: {
    glow: 0.15,
    strokeBoost: 0,
    auraRings: 0,
    auraGradient: false,
    particles: 0,
    pulse: false,
    floorShadow: false,
    lightWave: false,
    sigil: false,
    energyRing: false,
    burst: false,
    auraIntensity: 0.2,
  },
  SILVER: {
    glow: 0.28,
    strokeBoost: 0.2,
    auraRings: 0,
    auraGradient: false,
    particles: 0,
    pulse: false,
    floorShadow: true,
    lightWave: false,
    sigil: false,
    energyRing: false,
    burst: false,
    auraIntensity: 0.35,
  },
  GOLD: {
    glow: 0.4,
    strokeBoost: 0.3,
    auraRings: 1,
    auraGradient: false,
    particles: 8,
    pulse: false,
    floorShadow: true,
    lightWave: false,
    sigil: false,
    energyRing: false,
    burst: false,
    auraIntensity: 0.5,
  },
  PLATINUM: {
    glow: 0.52,
    strokeBoost: 0.5,
    auraRings: 2,
    auraGradient: true,
    particles: 12,
    pulse: true,
    floorShadow: true,
    lightWave: false,
    sigil: false,
    energyRing: false,
    burst: false,
    auraIntensity: 0.65,
  },
  DIAMOND: {
    glow: 0.65,
    strokeBoost: 0.8,
    auraRings: 2,
    auraGradient: true,
    particles: 18,
    pulse: true,
    floorShadow: true,
    lightWave: true,
    sigil: true,
    energyRing: false,
    burst: false,
    auraIntensity: 0.78,
  },
  MASTER: {
    glow: 0.75,
    strokeBoost: 1,
    auraRings: 3,
    auraGradient: true,
    particles: 22,
    pulse: true,
    floorShadow: true,
    lightWave: true,
    sigil: true,
    energyRing: true,
    burst: true,
    auraIntensity: 0.9,
  },
  GRANDMASTER: {
    glow: 0.83,
    strokeBoost: 1.15,
    auraRings: 3,
    auraGradient: true,
    particles: 28,
    pulse: true,
    floorShadow: true,
    lightWave: true,
    sigil: true,
    energyRing: true,
    burst: true,
    auraIntensity: 0.96,
  },
  CHALLENGER: {
    glow: 0.9,
    strokeBoost: 1.3,
    auraRings: 4,
    auraGradient: true,
    particles: 34,
    pulse: true,
    floorShadow: true,
    lightWave: true,
    sigil: true,
    energyRing: true,
    burst: true,
    auraIntensity: 1,
  },
};
