package com.ajou.muscleup.dto.shadow;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 이번 주 그림자 상태(GET /api/shadow). 본인 것만 — 이메일 · 사용자 번호 없음.
 * rest: 휴식 주(체력 바 대신 "이번 주는 쉬어요"), remaining: 남은 체력, streakWeeks: 연속 처치 주 수, lastWeek: 지난주 전적(없으면 null).
 */
public record ShadowStatusResponse(String name, LocalDate weekStart, LocalDate weekEnd, boolean rest, int hp, int damage, int remaining,
                                   boolean killed, LocalDateTime killedAt, int overkillPct, int level,
                                   List<ShadowHitResponse> hits, int streakWeeks, LastWeek lastWeek) {

    public record LastWeek(int hp, int damage, boolean killed, boolean rest) {}
}
