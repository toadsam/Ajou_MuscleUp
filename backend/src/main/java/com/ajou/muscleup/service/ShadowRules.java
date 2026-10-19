package com.ajou.muscleup.service;

import com.ajou.muscleup.entity.ShadowWeek;
import java.time.LocalDate;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;

/**
 * 주간 보스 "그림자"의 숫자와 공식(docs/design/shadow-boss.md 2절). 튜닝 상수는 모두 여기, 함수는 모두 순수 함수.
 *
 * - 힘(데미지) 단위 하나: 운동 세션은 볼륨(kg·회) ÷ 100, 맨몸 세트는 횟수 × 20kg 을 볼륨에 더한다, 러닝은 거리(m) ÷ 100.
 *   보통 세션(3,000~8,000kg) ≈ 30~80, 보통 러닝(3~8km) ≈ 30~80 — 둘이 비슷한 무게가 되게.
 * - 하루 상한 300(수기 입력 부풀리기 막기), 힘 1 미만은 공격 안 함(1분짜리 저장 막기).
 * - 체력 = max(100, round(최근 4주 중 힘 > 0 인 주의 평균 × 1.05)) — 지난 나보다 늘 조금 더 세다.
 * - 치명타(자기 기록 갱신이 있는 세션 · 러닝)만 레벨 배율 × (1.5 + 레벨 × 0.01). 평상 공격엔 레벨 배율 없음(공정한 거울).
 */
public final class ShadowRules {
    /** 보스 이름(8절 결정: "그림자" 그대로) */
    public static final String NAME = "그림자";

    /** 볼륨 이만큼(kg·회)이 힘 1 */
    public static final int VOLUME_PER_FORCE = 100;
    /** 맨몸 종목 1회를 이 무게로 친다 */
    public static final double BODYWEIGHT_KG = 20;
    /** 러닝 이만큼(m)이 힘 1 */
    public static final int METERS_PER_FORCE = 100;
    /** 하루에 들어가는 힘의 상한(상한 · 치명타 전 값 기준) */
    public static final int DAILY_CAP = 300;
    /** 이보다 작은 힘은 공격이 되지 않는다 */
    public static final int MIN_FORCE = 1;

    /** 체력 바닥값(지난 기록이 없을 때 · 평균이 작을 때) */
    public static final int MIN_HP = 100;
    /** 체력 = 평균 × 이 값 */
    public static final double HP_MARGIN = 1.05;
    /** 체력 계산에 보는 지난 주 수 */
    public static final int HP_WEEKS = 4;

    public static final double CRIT_BASE = 1.5;
    public static final double CRIT_PER_LEVEL = 0.01;

    /** 처치 보상 */
    public static final int KILL_POINTS = 10;
    public static final int KILL_BOXES = 1;
    public static final String BOX_SOURCE = "SHADOW";

    /** 연속 처치를 거꾸로 셀 때 최대 몇 주까지 보나(2년) */
    public static final int STREAK_LOOKBACK_WEEKS = 104;

    private ShadowRules() {}

    /** 운동 세션의 힘: (볼륨 + 맨몸 횟수 × 20kg) ÷ 100, 반올림. 6,000kg → 60 · 턱걸이 8회 3세트 → 480kg → 5 */
    public static int sessionForce(double totalVolume, int bodyweightReps) {
        double volume = totalVolume + bodyweightReps * BODYWEIGHT_KG;
        return (int) Math.round(volume / VOLUME_PER_FORCE);
    }

    /** 러닝의 힘: 거리(m) ÷ 100, 반올림. 5km → 50 */
    public static int runForce(int distanceM) {
        return (int) Math.round(distanceM / (double) METERS_PER_FORCE);
    }

    /** 하루 상한을 적용한 힘. 이미 오늘 들어간 힘(상한 전 값)이 많으면 남은 만큼만, 다 썼으면 0 */
    public static int capped(int force, long alreadyToday) {
        long room = DAILY_CAP - alreadyToday;
        if (room <= 0) return 0;
        return (int) Math.min(force, room);
    }

    /** 치명타 배율: 1.5 + 레벨 × 0.01 (Lv1 ×1.51, Lv20 ×1.7, Lv50 ×2.0) */
    public static double critMultiplier(int level) {
        return CRIT_BASE + Math.max(1, level) * CRIT_PER_LEVEL;
    }

    /** 실제로 들어가는 힘. 치명타면 배율을 곱해 반올림, 아니면 그대로 */
    public static int damage(int cappedForce, boolean crit, int level) {
        if (cappedForce <= 0) return 0;
        return crit ? (int) Math.round(cappedForce * critMultiplier(level)) : cappedForce;
    }

    /**
     * 이번 주 체력. 최근 4주의 주 합계 중 0 보다 큰 것만 평균 내고 × 1.05, 바닥 100.
     * [0, 300, 500, 0] → round(400 × 1.05) = 420. 지난 기록 없음 → 100
     */
    public static int hp(Collection<Integer> recentWeekDamages) {
        long sum = 0;
        int n = 0;
        for (Integer d : recentWeekDamages) {
            if (d != null && d > 0) {
                sum += d;
                n++;
            }
        }
        if (n == 0) return MIN_HP;
        return Math.max(MIN_HP, (int) Math.round(sum / (double) n * HP_MARGIN));
    }

    /** 남은 체력(0 아래로 내려가지 않음) */
    public static int remaining(int hp, int damage) {
        return Math.max(0, hp - damage);
    }

    /** 처치한 뒤 더 들어간 힘의 비율(%). 아직 못 잡았으면 0 */
    public static int overkillPct(int hp, int damage) {
        if (hp <= 0 || damage <= hp) return 0;
        return (int) Math.round((damage - hp) * 100.0 / hp);
    }

    /**
     * 연속 처치 주 수. 이번 주는 잡았을 때만 세고(진행 중이면 끊지 않음), 지난주부터 거꾸로 잡은 주를 센다.
     * 휴식 주는 건너뛴다(세지도 끊지도 않음). 행이 없는 주(운동 안 한 주) · 놓친 주에서 멈춘다.
     */
    public static int streakWeeks(Collection<ShadowWeek> weeks, LocalDate thisWeekStart) {
        Map<LocalDate, ShadowWeek> byWeek = new HashMap<>();
        for (ShadowWeek w : weeks) {
            byWeek.put(w.getWeekStart(), w);
        }
        ShadowWeek current = byWeek.get(thisWeekStart);
        int streak = current != null && current.getKilledAt() != null ? 1 : 0;
        for (int i = 1; i <= STREAK_LOOKBACK_WEEKS; i++) {
            ShadowWeek w = byWeek.get(thisWeekStart.minusWeeks(i));
            if (w == null) break;
            if (w.getKilledAt() != null) {
                streak++;
            } else if (!w.isRest()) {
                break;
            }
        }
        return streak;
    }
}
