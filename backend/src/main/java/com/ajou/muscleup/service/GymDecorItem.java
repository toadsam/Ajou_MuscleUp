package com.ajou.muscleup.service;

import java.util.EnumSet;
import java.util.Set;

/**
 * 홈 헬스장 꾸미기 물품. 코드는 저장되므로 바꾸지 않는다(새로 넣는 건 괜찮다).
 * 그림은 frontend/src/components/gymMap/decor.ts 가 같은 코드로 그린다(둘 다 고칠 것).
 * - goal 이 null 이면 처음부터 가진 기본 물품(화분 · 빨간 원).
 * - multi: 여러 자리에 동시에 놓을 수 있다(화분). 나머지는 한 자리에만.
 */
public enum GymDecorItem {
    PLANT("화분", null, 0, true, Slot.CORNER_TOP, Slot.CORNER_LEFT, Slot.CORNER_RIGHT),
    RING_RED("빨간 원판 무늬", null, 0, false, Slot.CENTER),

    CLOCK("벽시계", Goal.ATTENDANCE, 7, false, Slot.WALL),
    BANNER("모임 깃발", Goal.CREW, 1, false, Slot.WALL),
    TROPHY("트로피", Goal.BIG_THREE, 3, false, Slot.WALL, Slot.COUNTER),
    KETTLEBELL("케틀벨 세트", Goal.SESSIONS, 10, false, Slot.PLATFORM_SIDE, Slot.FLOOR_LEFT),
    SMITH("스미스 머신", Goal.EXERCISES, 5, false, Slot.PLATFORM_SIDE),
    BENCH("플랫 벤치", Goal.BENCH, 1, false, Slot.FLOOR_LEFT),
    BIKE("실내 사이클", Goal.RUN_KM, 10, false, Slot.FLOOR_LEFT),
    FRIDGE("음료 냉장고", Goal.DIET_DAYS, 7, false, Slot.CHECKIN_SIDE),
    PROTEIN("단백질 통", Goal.MY_FOODS, 3, false, Slot.COUNTER, Slot.CHECKIN_SIDE),
    FAN("선풍기", Goal.WEEKLY_STREAK, 2, false, Slot.CORNER_TOP, Slot.CORNER_LEFT, Slot.CORNER_RIGHT),
    SCALE("체중계", Goal.BODY, 1, false, Slot.CHECKIN_SIDE, Slot.CORNER_LEFT, Slot.CORNER_RIGHT),
    RING_YELLOW("노란 원판 무늬", Goal.ATTENDANCE, 30, false, Slot.CENTER);

    /** 꾸미기 자리. 위치 · 크기는 화면(decor.ts)이 정한다. defaultItem: 줄이 없을 때 놓여 있는 것 */
    public enum Slot {
        WALL(null), PLATFORM_SIDE(null), CORNER_TOP("PLANT"), FLOOR_LEFT(null), CENTER("RING_RED"),
        CHECKIN_SIDE(null), COUNTER(null), CORNER_LEFT("PLANT"), CORNER_RIGHT("PLANT");

        public final String defaultItem;

        Slot(String defaultItem) {
            this.defaultItem = defaultItem;
        }

        public static Slot parse(String s) {
            if (s == null) return null;
            try {
                return valueOf(s.trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                return null;
            }
        }
    }

    /** 얻는 조건 — 이미 쌓이는 기록으로만 센다 */
    public enum Goal {
        ATTENDANCE("운동 출석 %d일"),
        CREW("운동 모임 · 동아리 가입"),
        BIG_THREE("스쿼트 · 벤치프레스 · 데드리프트 기록"),
        SESSIONS("운동 세션 %d번"),
        EXERCISES("기록한 종목 %d가지"),
        BENCH("벤치프레스 기록"),
        RUN_KM("러닝 누적 %dkm"),
        DIET_DAYS("식단 기록 %d일"),
        MY_FOODS("내 음식 %d개 저장"),
        WEEKLY_STREAK("주간 목표 %d주 연속"),
        BODY("몸무게(체성분) 입력");

        private final String hint;

        Goal(String hint) {
            this.hint = hint;
        }

        public String hint(int goal) {
            return hint.contains("%d") ? String.format(hint, goal) : hint;
        }
    }

    public final String label;
    public final Goal goal;
    public final int target;
    public final boolean multi;
    public final Set<Slot> slots;

    GymDecorItem(String label, Goal goal, int target, boolean multi, Slot first, Slot... rest) {
        this.label = label;
        this.goal = goal;
        this.target = target;
        this.multi = multi;
        this.slots = EnumSet.of(first, rest);
    }

    public boolean isDefault() {
        return goal == null;
    }

    public static GymDecorItem parse(String code) {
        if (code == null) return null;
        try {
            return valueOf(code.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
