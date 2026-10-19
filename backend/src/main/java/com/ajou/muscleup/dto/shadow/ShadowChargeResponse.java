package com.ajou.muscleup.dto.shadow;

import java.util.Map;

/**
 * 운동 세션 · 러닝 저장 응답의 shadowCharge 칸 — 이 저장으로 그림자 던전에 모인 힘(docs/design/shadow-dungeon.md 2.2).
 * charged: 이번 저장이 통별로 모은 힘(상한 뒤, 0 인 통은 없음), total: 그 합, critToken: 치명타 토큰을 받았는지(PR),
 * capped: 하루 상한(300)에 걸려 일부 · 전부가 안 들어갔는지, chargeLeft · chargeTotal · critTokens: 저장 뒤 통 · 토큰 현황,
 * hp · remaining · killed: 이번 주 그림자 현황(충전 연출 옆 체력 바용).
 */
public record ShadowChargeResponse(Map<String, Integer> charged, int total, boolean critToken, boolean capped,
                                   Map<String, Integer> chargeLeft, int chargeTotal, int critTokens,
                                   int hp, int remaining, boolean killed) {}
