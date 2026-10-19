package com.ajou.muscleup.dto.shadow;

/**
 * 던전에서 기술 한 번(POST /api/shadow/dungeon/strike).
 * skill: LEGS · CHEST · BACK · ARMS · RUN, grade: PERFECT · GOOD · MISS(없으면 MISS), crit: 치명타 토큰을 이 타에 쓸지.
 */
public record ShadowStrikeRequest(String skill, String grade, Boolean crit) {}
