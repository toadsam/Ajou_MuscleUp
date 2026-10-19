package com.ajou.muscleup.service;

import com.ajou.muscleup.entity.ShadowWeek;
import java.time.LocalDate;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 주간 보스 "그림자"의 숫자와 공식(docs/design/shadow-boss.md 2절). 튜닝 상수는 모두 여기, 함수는 모두 순수 함수.
 *
 * - 힘(데미지) 단위 하나: 운동 세션은 볼륨(kg·회) ÷ 100, 맨몸 세트는 횟수 × 20kg 을 볼륨에 더한다, 러닝은 거리(m) ÷ 100.
 *   보통 세션(3,000~8,000kg) ≈ 30~80, 보통 러닝(3~8km) ≈ 30~80 — 둘이 비슷한 무게가 되게.
 * - 하루 상한 300(수기 입력 부풀리기 막기), 힘 1 미만은 공격 안 함(1분짜리 저장 막기).
 * - 체력 = max(100, round(최근 4주 중 힘 > 0 인 주의 평균 × 1.05)) — 지난 나보다 늘 조금 더 세다.
 * - 치명타(자기 기록 갱신이 있는 세션 · 러닝)만 레벨 배율 × (1.5 + 레벨 × 0.01). 평상 공격엔 레벨 배율 없음(공정한 거울).
 *
 * 2차 던전(docs/design/shadow-dungeon.md 2절): 저장은 힘을 통(기술)에 모으고, 던전에서 한 번 누를 때 통에서 60씩 쓴다.
 * - 통 5개 = 종목 category: 하체 LEGS(지진) · 가슴 CHEST(밀어내기) · 등 BACK(들어 던지기) · 어깨 · 팔 · 코어 · 기타 ARMS(연타) · 러닝 RUN(돌진).
 * - 타이밍 PERFECT +5% · GOOD +2%(지도판에서 낮춤), 패시브 4개 각 +5%(합 상한 15%), 치명타 토큰은 내가 고른 타에(세션당 1개).
 * - 능력치 · 패시브는 데미지 총량을 운동량 밖으로 늘리지 않는다: 보너스 전부 합쳐도 한 타의 20% 이하.
 * 지도판(docs/design/shadow-dungeon-map.md 3절): 주마다 잡몹 4마리(+ 희귀 1). 체력 = 보스 체력 × 비율(최소 15), 오버킬 없음(남는 힘은 통으로), 보상은 조각.
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

    // ---- 2차 던전 ----
    /** 통(기술) 코드 — 문자열(enum 칸 금지). 순서 = 화면의 원판 순서 */
    public static final String LEGS = "LEGS";
    public static final String CHEST = "CHEST";
    public static final String BACK = "BACK";
    public static final String ARMS = "ARMS";
    public static final String RUN = "RUN";
    public static final List<String> SKILLS = List.of(LEGS, CHEST, BACK, ARMS, RUN);
    /** 기술 이름(화면 · 오류 문구) */
    public static final Map<String, String> SKILL_LABEL = Map.of(
            LEGS, "지진", CHEST, "밀어내기", BACK, "들어 던지기", ARMS, "연타", RUN, "돌진");
    /** 통 이름(어떤 운동이 채우는지) */
    public static final Map<String, String> POOL_LABEL = Map.of(
            LEGS, "하체", CHEST, "가슴", BACK, "등", ARMS, "어깨 · 팔 · 코어", RUN, "러닝");
    /** 한 번 누르면 통에서 이만큼(세트 묶음 하나) */
    public static final int STRIKE_CHUNK = 60;
    /** 타이밍 등급 · 보너스(%) */
    public static final String PERFECT = "PERFECT";
    public static final String GOOD = "GOOD";
    public static final String MISS = "MISS";
    /** 지도판(shadow-dungeon-map.md 4.2): 조작 영향을 "거의 없게" — 10 · 5 에서 낮춤 */
    public static final int TIMING_PERFECT_PCT = 5;
    public static final int TIMING_GOOD_PCT = 2;
    /** 패시브 하나 +5%, 합쳐서 15% 까지 */
    public static final int PASSIVE_PCT = 5;
    public static final int PASSIVE_CAP_PCT = 15;
    public static final String PASSIVE_BIG_THREE = "삼대장";
    public static final String PASSIVE_LONG_RUN = "장거리";
    public static final String PASSIVE_STEADY = "꾸준함";
    public static final String PASSIVE_HUNTER = "그림자 사냥꾼";
    /** 삼대장: 3대 추정 1RM 합(kg) */
    public static final int BIG_THREE_KG = 300;
    public static final int BIG_THREE_KG_FEMALE = 200;
    /** 장거리: 이번 주 러닝(m) */
    public static final int LONG_RUN_M = 10_000;
    /** 꾸준함: 이번 주 출석(운동한 날) */
    public static final int STEADY_DAYS = 3;
    /** 그림자 사냥꾼(칭호 T_SHADOW_STREAK_4): 치명타 배율 + */
    public static final double HUNTER_CRIT_BONUS = 0.1;
    /** 연타 타 수 · 들어 던지기 분배 */
    public static final int ARMS_STRIKES = 4;
    public static final double BACK_FIRST_SHARE = 0.3;

    // ---- 지도판 잡몹 ----
    /** 잡몹 한 종류: 이름 · 보스 체력 대비 비율(%) · 잡으면 받는 조각 · 희귀 */
    public record MobDef(String code, String name, int hpPct, int shards, boolean rare) {}

    public static final MobDef TOMORROW = new MobDef("TOMORROW", "내일부터", 10, 1, false);
    public static final MobDef MIDNIGHT_SNACK = new MobDef("MIDNIGHT_SNACK", "야식 슬라임", 12, 1, false);
    public static final MobDef SNOOZE = new MobDef("SNOOZE", "알람 스누즈", 10, 1, false);
    public static final MobDef EXCUSE = new MobDef("EXCUSE", "핑계", 14, 2, false);
    public static final MobDef SOFA = new MobDef("SOFA", "소파 괴물", 20, 5, true);
    /** 매주 나오는 잡몹(희귀 제외) */
    public static final List<MobDef> COMMON_MOBS = List.of(TOMORROW, MIDNIGHT_SNACK, SNOOZE, EXCUSE);
    public static final Map<String, MobDef> MOBS = Map.of(
            TOMORROW.code(), TOMORROW, MIDNIGHT_SNACK.code(), MIDNIGHT_SNACK, SNOOZE.code(), SNOOZE, EXCUSE.code(), EXCUSE, SOFA.code(), SOFA);
    public static final int MOB_MIN_HP = 15;
    /** 지난주 보스를 이만큼(%) 이상 오버킬로 잡으면 이번 주에 희귀 잡몹 */
    public static final int RARE_OVERKILL_PCT = 50;
    /** 맵 자리 수(입구 방 2 · 가운데 방 2 · 희귀 1) */
    public static final int MOB_SLOTS = 5;
    public static final String TARGET_BOSS = "BOSS";

    private ShadowRules() {}

    /** 잡몹 체력: round(보스 체력 × 비율), 최소 15 */
    public static int mobHp(int bossHp, MobDef def) {
        return Math.max(MOB_MIN_HP, (int) Math.round(bossHp * def.hpPct() / 100.0));
    }

    /**
     * 이번 주 잡몹 배치: 매주 4종 + (지난주 큰 오버킬이면) 희귀 1. 자리는 사용자 · 주 시드로 섞는다(같은 주는 늘 같은 배치).
     * 반환: 자리 순서대로 MobDef(자리 번호 = 목록 위치, 희귀는 마지막 자리 4)
     */
    public static List<MobDef> mobLineup(long userId, LocalDate weekStart, boolean rare) {
        java.util.ArrayList<MobDef> out = new java.util.ArrayList<>(COMMON_MOBS);
        java.util.Collections.shuffle(out, new java.util.Random(userId * 1_000_003L + weekStart.toEpochDay()));
        if (rare) out.add(SOFA);
        return List.copyOf(out);
    }

    /**
     * 잡몹을 칠 때 실제로 쓰는 힘: 통에서 꺼낸 force 중 남은 체력을 채우는 가장 작은 값(나머지는 통으로).
     * 보너스 · 치명타를 넣은 피해가 remaining 이상이 되는 최소 f(1..force). 다 써도 모자라면 force
     */
    public static int neededForce(int force, int remaining, int bonusPct, boolean crit, double critMultiplier) {
        for (int f = 1; f <= force; f++) {
            if (strikeDamage(f, bonusPct, crit, critMultiplier) >= remaining) return f;
        }
        return force;
    }

    /** 종목 category → 통. LEGS · CHEST · BACK 은 그대로, 나머지(SHOULDERS · ARMS · CORE · OTHER · 모름)는 ARMS */
    public static String skillOf(String category) {
        if (category == null) return ARMS;
        return switch (category) {
            case LEGS, CHEST, BACK -> category;
            default -> ARMS;
        };
    }

    public static boolean isSkill(String skill) {
        return skill != null && SKILLS.contains(skill);
    }

    /** 등급 문자열 정리: 모르는 값 · null 은 MISS */
    public static String grade(String grade) {
        return PERFECT.equals(grade) ? PERFECT : GOOD.equals(grade) ? GOOD : MISS;
    }

    /** 한 번 누를 때 통에서 쓰는 힘: min(남은 힘, 60) */
    public static int chunk(int pool) {
        return Math.max(0, Math.min(pool, STRIKE_CHUNK));
    }

    /** 타이밍 보너스(%) */
    public static int timingPct(String grade) {
        return switch (grade(grade)) {
            case PERFECT -> TIMING_PERFECT_PCT;
            case GOOD -> TIMING_GOOD_PCT;
            default -> 0;
        };
    }

    /** 그 기술에 걸리는 패시브 보너스(%): 삼대장(LEGS · CHEST · BACK) · 장거리(RUN) · 꾸준함(전부). 합 15% 까지 */
    public static int passivePct(String skill, Set<String> passives) {
        int pct = 0;
        if (passives.contains(PASSIVE_BIG_THREE) && (LEGS.equals(skill) || CHEST.equals(skill) || BACK.equals(skill))) pct += PASSIVE_PCT;
        if (passives.contains(PASSIVE_LONG_RUN) && RUN.equals(skill)) pct += PASSIVE_PCT;
        if (passives.contains(PASSIVE_STEADY)) pct += PASSIVE_PCT;
        return Math.min(pct, PASSIVE_CAP_PCT);
    }

    /** 치명타 배율(사냥꾼 패시브면 +0.1) */
    public static double critMultiplier(int level, boolean hunter) {
        return critMultiplier(level) + (hunter ? HUNTER_CRIT_BONUS : 0);
    }

    /** 보너스(%)를 더한 힘: 60 + 15% → 69 */
    public static int boosted(int force, int bonusPct) {
        return (int) Math.round(force * (100 + Math.max(0, bonusPct)) / 100.0);
    }

    /** 실제 들어가는 힘(보너스 뒤, 치명타면 배율) */
    public static int strikeDamage(int force, int bonusPct, boolean crit, double critMultiplier) {
        int b = boosted(force, bonusPct);
        if (b <= 0) return 0;
        return crit ? (int) Math.round(b * critMultiplier) : b;
    }

    /**
     * 연출용 타 분배(합 = damage). 지진 · 밀어내기 · 돌진 1타, 들어 던지기 [30%, 70%], 연타 4타 균등,
     * 돌진은 장거리 패시브면 2타 반반. 0 이면 [0].
     */
    public static List<Integer> shares(String skill, int damage, Set<String> passives) {
        if (damage <= 0) return List.of(0);
        if (BACK.equals(skill)) {
            int first = (int) Math.round(damage * BACK_FIRST_SHARE);
            return List.of(first, damage - first);
        }
        if (ARMS.equals(skill)) return split(damage, ARMS_STRIKES);
        if (RUN.equals(skill) && passives.contains(PASSIVE_LONG_RUN)) return split(damage, 2);
        return List.of(damage);
    }

    /** n 등분(나머지는 뒤 타에). 타 수가 힘보다 많으면 힘만큼만 */
    static List<Integer> split(int damage, int n) {
        int count = Math.max(1, Math.min(n, damage));
        int base = damage / count;
        int rest = damage - base * count;
        java.util.ArrayList<Integer> out = new java.util.ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            out.add(base + (i >= count - rest ? 1 : 0));
        }
        return List.copyOf(out);
    }

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
