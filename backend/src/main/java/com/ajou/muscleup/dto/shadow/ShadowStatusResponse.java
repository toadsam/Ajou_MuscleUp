package com.ajou.muscleup.dto.shadow;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 이번 주 그림자 상태(GET /api/shadow · POST /api/shadow/dungeon/enter). 본인 것만 — 이메일 · 사용자 번호 없음.
 * rest: 휴식 주(체력 바 대신 "이번 주는 쉬어요"), remaining: 남은 체력, streakWeeks: 연속 처치 주 수, lastWeek: 지난주 전적(없으면 null).
 * 2차 던전: charge(통별 안 쓴 힘, LEGS · CHEST · BACK · ARMS · RUN 순), chargeTotal, critTokens(안 쓴 치명타),
 * passives(켜진 패시브 이름), stats(능력치 — 전부 기존 기록에서 읽은 값).
 */
public record ShadowStatusResponse(String name, LocalDate weekStart, LocalDate weekEnd, boolean rest, int hp, int damage, int remaining,
                                   boolean killed, LocalDateTime killedAt, int overkillPct, int level,
                                   List<ShadowHitResponse> hits, int streakWeeks, LastWeek lastWeek,
                                   Map<String, Integer> charge, int chargeTotal, int critTokens, List<String> passives, Stats stats) {
    public record LastWeek(int hp, int damage, boolean killed, boolean rest) {}

    /**
     * strengthKg: 3대 추정 1RM 합, enduranceKm: 최근 4주 러닝 거리, attendanceStreak: 출석 연속일,
     * weeklyStreak: 주간 목표 연속 주, level: 이번 주 치명타 배율에 쓰는 레벨
     */
    public record Stats(int strengthKg, double enduranceKm, int attendanceStreak, int weeklyStreak, int level) {}
}
