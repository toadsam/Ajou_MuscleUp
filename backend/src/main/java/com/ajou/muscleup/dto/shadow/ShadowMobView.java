package com.ajou.muscleup.dto.shadow;

/**
 * 던전 잡몹 한 마리(상태 · enter 응답의 mobs). 본인 것만.
 * slot: 맵 자리 번호(화면이 방 · 위치로), remaining: 남은 체력, rare: 희귀(소파 괴물), shards: 잡으면 받는 조각.
 */
public record ShadowMobView(Long id, String code, String name, int slot, int hp, int remaining, boolean killed, boolean rare, int shards) {}
