package com.ajou.muscleup.service;

import java.util.Arrays;
import java.util.List;

/**
 * 운동 기록 · 운동 세션에 쓰는 종목. 화면 목록은 frontend/src/lib/lifts.ts 에 같은 순서로 있다(둘 다 고칠 것).
 * - bigThree: 개인 최고가 마이페이지 3대 기록에도 반영된다.
 * - bodyweight: 맨몸(추가 무게 0 가능). 무게로 비교할 수 없어 개인 최고 · 운동 기록(LiftEntry)에는 넣지 않는다(세션 기록에만 남음).
 */
public enum LiftExercise {
    // 처음 8개는 PR F 때부터 있던 코드 — 바꾸지 않는다(저장된 기록)
    SQUAT("스쿼트", Category.LEGS, true, false),
    BENCH("벤치프레스", Category.CHEST, true, false),
    DEADLIFT("데드리프트", Category.BACK, true, false),
    OHP("오버헤드프레스", Category.SHOULDERS, false, false),
    ROW("바벨로우", Category.BACK, false, false),
    INCLINE_BENCH("인클라인 벤치", Category.CHEST, false, false),
    LEG_PRESS("레그프레스", Category.LEGS, false, false),
    LAT_PULLDOWN("랫풀다운", Category.BACK, false, false),

    FRONT_SQUAT("프론트 스쿼트", Category.LEGS, false, false),
    ROMANIAN_DEADLIFT("루마니안 데드리프트", Category.LEGS, false, false),
    LUNGE("런지", Category.LEGS, false, false),
    LEG_EXTENSION("레그 익스텐션", Category.LEGS, false, false),
    LEG_CURL("레그 컬", Category.LEGS, false, false),
    CALF_RAISE("카프 레이즈", Category.LEGS, false, false),

    DB_BENCH("덤벨 벤치프레스", Category.CHEST, false, false),
    CHEST_FLY("체스트 플라이", Category.CHEST, false, false),
    CABLE_CROSSOVER("케이블 크로스오버", Category.CHEST, false, false),
    DIPS("딥스", Category.CHEST, false, true),
    PUSH_UP("푸시업", Category.CHEST, false, true),

    PULL_UP("턱걸이", Category.BACK, false, true),
    SEATED_ROW("시티드 로우", Category.BACK, false, false),
    DB_ROW("원암 덤벨 로우", Category.BACK, false, false),

    DB_SHOULDER_PRESS("덤벨 숄더프레스", Category.SHOULDERS, false, false),
    LATERAL_RAISE("사이드 레터럴 레이즈", Category.SHOULDERS, false, false),
    REAR_DELT_FLY("리어 델트 플라이", Category.SHOULDERS, false, false),

    BARBELL_CURL("바벨 컬", Category.ARMS, false, false),
    DB_CURL("덤벨 컬", Category.ARMS, false, false),
    TRICEP_PUSHDOWN("트라이셉스 푸시다운", Category.ARMS, false, false),
    SKULL_CRUSHER("라잉 트라이셉스 익스텐션", Category.ARMS, false, false),

    CRUNCH("크런치", Category.CORE, false, true),
    HANGING_LEG_RAISE("행잉 레그 레이즈", Category.CORE, false, true);

    public enum Category { LEGS, CHEST, BACK, SHOULDERS, ARMS, CORE }

    public final String label;
    public final Category category;
    public final boolean bigThree;
    public final boolean bodyweight;

    LiftExercise(String label, Category category, boolean bigThree, boolean bodyweight) {
        this.label = label;
        this.category = category;
        this.bigThree = bigThree;
        this.bodyweight = bodyweight;
    }

    public static LiftExercise parse(String code) {
        return Arrays.stream(values()).filter(e -> e.name().equalsIgnoreCase(code == null ? "" : code.trim()))
                .findFirst().orElse(null);
    }

    public record View(String code, String label, String category, boolean bigThree, boolean bodyweight) {}

    public static List<View> all() {
        return Arrays.stream(values()).map(e -> new View(e.name(), e.label, e.category.name(), e.bigThree, e.bodyweight)).toList();
    }
}
