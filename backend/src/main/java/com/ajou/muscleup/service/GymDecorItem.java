package com.ajou.muscleup.service;

import java.util.EnumSet;
import java.util.Set;

/**
 * 홈 헬스장 꾸미기 물품. 코드는 저장되므로 바꾸지 않는다(새로 넣는 건 괜찮다).
 * 그림은 frontend/src/components/gymMap/decor.ts · engine.ts 가 같은 코드로 그린다(둘 다 고칠 것).
 * - goal 이 null 이면 처음부터 가진 것(화분 · 빨간 원 · 고무 매트 · 유니폼 색 · 머리색).
 * - multi: 여러 자리에 동시에 놓을 수 있다(화분 · 머리색). 나머지는 한 자리에만.
 * - kind: DECOR 물품 · THEME 바닥과 벽 · STAFF 새 직원(부르기/쉬게 하기) · LOOK 직원 겉모습(개수 세기에서 뺀다)
 */
public enum GymDecorItem {
    PLANT(Kind.DECOR, "화분", null, 0, true, Slot.CORNER_TOP, Slot.CORNER_LEFT, Slot.CORNER_RIGHT),
    RING_RED(Kind.DECOR, "빨간 원판 무늬", null, 0, false, Slot.CENTER),

    CLOCK(Kind.DECOR, "벽시계", Goal.ATTENDANCE, 7, false, Slot.WALL),
    BANNER(Kind.DECOR, "모임 깃발", Goal.CREW, 1, false, Slot.WALL),
    TROPHY(Kind.DECOR, "트로피", Goal.BIG_THREE, 3, false, Slot.WALL, Slot.COUNTER),
    KETTLEBELL(Kind.DECOR, "케틀벨 세트", Goal.SESSIONS, 10, false, Slot.PLATFORM_SIDE, Slot.FLOOR_LEFT),
    SMITH(Kind.DECOR, "스미스 머신", Goal.EXERCISES, 5, false, Slot.PLATFORM_SIDE),
    BENCH(Kind.DECOR, "플랫 벤치", Goal.BENCH, 1, false, Slot.FLOOR_LEFT),
    BIKE(Kind.DECOR, "실내 사이클", Goal.RUN_KM, 10, false, Slot.FLOOR_LEFT),
    FRIDGE(Kind.DECOR, "음료 냉장고", Goal.DIET_DAYS, 7, false, Slot.CHECKIN_SIDE),
    PROTEIN(Kind.DECOR, "단백질 통", Goal.MY_FOODS, 3, false, Slot.COUNTER, Slot.CHECKIN_SIDE),
    FAN(Kind.DECOR, "선풍기", Goal.WEEKLY_STREAK, 2, false, Slot.CORNER_TOP, Slot.CORNER_LEFT, Slot.CORNER_RIGHT),
    SCALE(Kind.DECOR, "체중계", Goal.BODY, 1, false, Slot.CHECKIN_SIDE, Slot.CORNER_LEFT, Slot.CORNER_RIGHT),
    RING_YELLOW(Kind.DECOR, "노란 원판 무늬", Goal.ATTENDANCE, 30, false, Slot.CENTER),

    // ── 테마(바닥 · 벽)
    THEME_RUBBER(Kind.THEME, "고무 매트", null, 0, false, Slot.THEME),
    THEME_MAPLE(Kind.THEME, "메이플 우드", Goal.ATTENDANCE, 30, false, Slot.THEME),
    THEME_CONCRETE(Kind.THEME, "콘크리트 박스", Goal.SESSIONS, 30, false, Slot.THEME),
    THEME_BRICK(Kind.THEME, "올드스쿨 벽돌", Goal.BIG_THREE_KG, 300, false, Slot.THEME),

    // ── 새 직원(자리에 넣으면 출근, 비우면 쉼)
    TRAINER(Kind.STAFF, "PT 트레이너", Goal.SESSIONS, 20, false, Slot.HIRE_TRAINER),
    CLEANER(Kind.STAFF, "청소 알바", Goal.ATTENDANCE, 14, false, Slot.HIRE_CLEANER),
    TOWEL(Kind.STAFF, "수건 알바", Goal.WEEKLY_STREAK, 3, false, Slot.HIRE_TOWEL),

    // ── 직원 겉모습(처음부터). 직원은 실제 회원과 헷갈리지 않게 조끼를 입고, 회원 민소매 색(빨강 · 파랑 · 노랑 · 초록) 중 노랑만 쓴다
    UNIFORM_YELLOW(Kind.LOOK, "노란 조끼", null, 0, false, Slot.UNIFORM),
    UNIFORM_ORANGE(Kind.LOOK, "주황 조끼", null, 0, false, Slot.UNIFORM),
    UNIFORM_WHITE(Kind.LOOK, "흰 조끼", null, 0, false, Slot.UNIFORM),
    UNIFORM_CHARCOAL(Kind.LOOK, "먹색 조끼", null, 0, false, Slot.UNIFORM),
    HAIR_BLACK(Kind.LOOK, "검은 머리", null, 0, true, Slot.hairSlots()),
    HAIR_BROWN(Kind.LOOK, "갈색 머리", null, 0, true, Slot.hairSlots()),
    HAIR_GRAY(Kind.LOOK, "회색 머리", null, 0, true, Slot.hairSlots()),
    HAIR_BLOND(Kind.LOOK, "밝은 머리", null, 0, true, Slot.hairSlots());

    public enum Kind { DECOR, THEME, STAFF, LOOK }

    /** 꾸미기 자리. 위치 · 크기는 화면(decor.ts)이 정한다. defaultItem: 줄이 없을 때 놓여 있는 것 */
    public enum Slot {
        WALL(null), PLATFORM_SIDE(null), CORNER_TOP("PLANT"), FLOOR_LEFT(null), CENTER("RING_RED"),
        CHECKIN_SIDE(null), COUNTER(null), CORNER_LEFT("PLANT"), CORNER_RIGHT("PLANT"),
        THEME("THEME_RUBBER"), UNIFORM("UNIFORM_YELLOW"),
        HIRE_TRAINER(null), HIRE_CLEANER(null), HIRE_TOWEL(null),
        HAIR_COACH("HAIR_BLACK"), HAIR_OWNER("HAIR_GRAY"), HAIR_STAFF("HAIR_BROWN"),
        HAIR_TRAINER("HAIR_BLACK"), HAIR_CLEANER("HAIR_BROWN"), HAIR_TOWEL("HAIR_BLOND");

        public final String defaultItem;

        Slot(String defaultItem) {
            this.defaultItem = defaultItem;
        }

        static Slot[] hairSlots() {
            return new Slot[] {HAIR_COACH, HAIR_OWNER, HAIR_STAFF, HAIR_TRAINER, HAIR_CLEANER, HAIR_TOWEL};
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
        BIG_THREE_KG("3대 합계 %dkg"),
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

    public final Kind kind;
    public final String label;
    public final Goal goal;
    public final int target;
    public final boolean multi;
    public final Set<Slot> slots;

    GymDecorItem(Kind kind, String label, Goal goal, int target, boolean multi, Slot... slots) {
        this.kind = kind;
        this.label = label;
        this.goal = goal;
        this.target = target;
        this.multi = multi;
        this.slots = EnumSet.noneOf(Slot.class);
        this.slots.addAll(java.util.List.of(slots));
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
