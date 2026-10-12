package com.ajou.muscleup.service;

/**
 * 활동 레벨 — 캐릭터 레벨(3대 · 체성분)과 따로, 활동 점수(CharacterProfile.attendancePoints: 출석 · 주간 목표 · 오늘 할 일)를
 * 상한 없이 쌓아 올리는 레벨. 캐릭터 레벨 쪽 출석 보너스는 20점이면 상한(8점)이라 그 뒤 활동이 보이지 않던 것을 채운다.
 * n → n+1 에 필요한 점수 = 40 + 10 × (n-1). 주 3번 운동 + 할 일이면 한 주 80점 안팎 → 2주쯤 Lv5, 두 달쯤 Lv10.
 */
public record ActivityLevel(int level, int totalPoints, int pointsInLevel, int pointsForNext) {
    static final int BASE = 40;
    static final int STEP = 10;

    public static ActivityLevel of(int totalPoints) {
        int total = Math.max(0, totalPoints);
        int level = 1;
        int left = total;
        while (left >= need(level)) {
            left -= need(level);
            level++;
        }
        return new ActivityLevel(level, total, left, need(level));
    }

    static int need(int level) {
        return BASE + STEP * (level - 1);
    }
}
