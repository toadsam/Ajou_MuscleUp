package com.ajou.muscleup.service;

import java.util.Arrays;
import java.util.List;

/** 운동 기록에 쓰는 종목. 3대(스쿼트 · 벤치 · 데드)는 개인 최고가 마이페이지 3대 기록에도 반영된다 */
public enum LiftExercise {
    SQUAT("스쿼트", true),
    BENCH("벤치프레스", true),
    DEADLIFT("데드리프트", true),
    OHP("오버헤드프레스", false),
    ROW("바벨로우", false),
    INCLINE_BENCH("인클라인 벤치", false),
    LEG_PRESS("레그프레스", false),
    LAT_PULLDOWN("랫풀다운", false);

    public final String label;
    public final boolean bigThree;

    LiftExercise(String label, boolean bigThree) {
        this.label = label;
        this.bigThree = bigThree;
    }

    public static LiftExercise parse(String code) {
        return Arrays.stream(values()).filter(e -> e.name().equalsIgnoreCase(code == null ? "" : code.trim()))
                .findFirst().orElse(null);
    }

    public record View(String code, String label, boolean bigThree) {}

    public static List<View> all() {
        return Arrays.stream(values()).map(e -> new View(e.name(), e.label, e.bigThree)).toList();
    }
}
