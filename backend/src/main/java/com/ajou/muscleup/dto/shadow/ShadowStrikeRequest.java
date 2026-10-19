package com.ajou.muscleup.dto.shadow;

/**
 * 던전에서 기술 한 번(POST /api/shadow/dungeon/strike).
 * target: "BOSS"(없으면 보스) 또는 잡몹 id(문자열 숫자), skill: LEGS · CHEST · BACK · ARMS · RUN,
 * grade: PERFECT · GOOD · MISS(없으면 MISS), crit: 치명타 토큰을 이 타에 쓸지.
 */
public record ShadowStrikeRequest(String target, String skill, String grade, Boolean crit) {}
