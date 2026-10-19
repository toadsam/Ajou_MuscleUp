package com.ajou.muscleup.dto.shadow;

import java.time.LocalDate;

/** 전적 한 주(GET /api/shadow/history). 행이 없는 주(운동 안 한 주)는 목록에 없다 — 화면이 "놓침"으로 채운다 */
public record ShadowHistoryItem(LocalDate weekStart, int hp, int damage, boolean killed, boolean rest) {}
