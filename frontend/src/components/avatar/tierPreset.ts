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
    glow: 0.08,
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
    glow: 0.22,
    strokeBoost: 0.35,
    auraRings: 1,
    auraGradient: false,
    particles: 6,
    pulse: false,
    floorShadow: true,
    lightWave: false,
    sigil: false,
    energyRing: false,
    burst: false,
    auraIntensity: 0.42,
  },
  GOLD: {
    glow: 0.55,
    strokeBoost: 0.7,
    auraRings: 2,
    auraGradient: false,
    particles: 14,
    pulse: false,
    floorShadow: true,
    lightWave: false,
    sigil: false,
    energyRing: false,
    burst: false,
    auraIntensity: 0.62,
  },
  PLATINUM: {
    glow: 0.7,
    strokeBoost: 1,
    auraRings: 3,
    auraGradient: true,
    particles: 20,
    pulse: true,
    floorShadow: true,
    lightWave: false,
    sigil: false,
    energyRing: false,
    burst: false,
    auraIntensity: 0.78,
  },
  DIAMOND: {
    glow: 0.84,
    strokeBoost: 1.35,
    auraRings: 4,
    auraGradient: true,
    particles: 28,
    pulse: true,
    floorShadow: true,
    lightWave: true,
    sigil: true,
    energyRing: false,
    burst: false,
    auraIntensity: 0.9,
  },
  MASTER: {
    glow: 0.95,
    strokeBoost: 1.8,
    auraRings: 5,
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
  GRANDMASTER: {
    glow: 1.05,
    strokeBoost: 2.15,
    auraRings: 6,
    auraGradient: true,
    particles: 40,
    pulse: true,
    floorShadow: true,
    lightWave: true,
    sigil: true,
    energyRing: true,
    burst: true,
    auraIntensity: 1,
  },
  CHALLENGER: {
    glow: 1.15,
    strokeBoost: 2.5,
    auraRings: 7,
    auraGradient: true,
    particles: 48,
    pulse: true,
    floorShadow: true,
    lightWave: true,
    sigil: true,
    energyRing: true,
    burst: true,
    auraIntensity: 1,
  },
};
