package com.ajou.muscleup.service;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * 홈 헬스장 꾸미기 물품. 코드는 저장되므로 바꾸지 않는다(새로 넣는 건 괜찮다).
 * 그림은 frontend/src/components/gymMap/decor.ts · engine.ts 가 같은 코드로 그린다(둘 다 고칠 것).
 * - goal 이 null 이면 처음부터 가진 것(화분 · 빨간 원 · 고무 매트 · 유니폼 색 · 머리색).
 * - multi: 여러 자리에 동시에 놓을 수 있다(화분 · 머리색). 나머지는 한 자리에만.
 * - kind: DECOR 물품 · THEME 바닥과 벽 · STAFF 새 직원(부르기/쉬게 하기) · LOOK 직원 겉모습(개수 세기에서 뺀다)
 *         · SPACE 새 공간(2층 · 러닝 트랙 · 식당). 공간은 자리에 놓지 않고, 열려야 그 공간 자리에 물건을 놓을 수 있다.
 */
public enum GymDecorItem {
    PLANT(Kind.DECOR, "화분", null, 0, true, Slot.group(Slot.Group.CORNER, Slot.Group.FIELD)),
    RING_RED(Kind.DECOR, "빨간 원판 무늬", null, 0, false, Slot.CENTER),

    CLOCK(Kind.DECOR, "벽시계", Goal.ATTENDANCE, 7, false, Slot.group(Slot.Group.WALL)),
    BANNER(Kind.DECOR, "모임 깃발", Goal.CREW, 1, false, Slot.group(Slot.Group.WALL)),
    TROPHY(Kind.DECOR, "트로피", Goal.BIG_THREE, 3, false, Slot.plus(Slot.group(Slot.Group.WALL), Slot.COUNTER)),
    KETTLEBELL(Kind.DECOR, "케틀벨 세트", Goal.SESSIONS, 10, false,
            Slot.plus(Slot.group(Slot.Group.FLOOR, Slot.Group.TALL), Slot.PLATFORM_SIDE, Slot.FLOOR_LEFT)),
    SMITH(Kind.DECOR, "스미스 머신", Goal.EXERCISES, 5, false, Slot.plus(Slot.group(Slot.Group.TALL), Slot.PLATFORM_SIDE)),
    BENCH(Kind.DECOR, "플랫 벤치", Goal.BENCH, 1, false, Slot.plus(Slot.group(Slot.Group.FLOOR, Slot.Group.FIELD), Slot.FLOOR_LEFT)),
    BIKE(Kind.DECOR, "실내 사이클", Goal.RUN_KM, 10, false, Slot.plus(Slot.group(Slot.Group.FLOOR), Slot.FLOOR_LEFT)),
    FRIDGE(Kind.DECOR, "음료 냉장고", Goal.DIET_DAYS, 7, false, Slot.plus(Slot.group(Slot.Group.SIDE), Slot.CHECKIN_SIDE)),
    PROTEIN(Kind.DECOR, "단백질 통", Goal.MY_FOODS, 3, false,
            Slot.plus(Slot.group(Slot.Group.SIDE, Slot.Group.COUNTER), Slot.COUNTER, Slot.CHECKIN_SIDE)),
    FAN(Kind.DECOR, "선풍기", Goal.WEEKLY_STREAK, 2, false, Slot.group(Slot.Group.CORNER)),
    SCALE(Kind.DECOR, "체중계", Goal.BODY, 1, false,
            Slot.plus(Slot.group(Slot.Group.SIDE), Slot.CHECKIN_SIDE, Slot.CORNER_LEFT, Slot.CORNER_RIGHT, Slot.F2_CORNER_L, Slot.F2_CORNER_R)),
    RING_YELLOW(Kind.DECOR, "노란 원판 무늬", Goal.ATTENDANCE, 30, false, Slot.CENTER),

    // ── 2층 전용
    YOGA_MAT(Kind.DECOR, "스트레칭 매트", Goal.ATTENDANCE, 45, false, Slot.group(Slot.Group.FLOOR)),
    SANDBAG(Kind.DECOR, "샌드백", Goal.SESSIONS, 40, false, Slot.group(Slot.Group.TALL)),
    PULLUP_BAR(Kind.DECOR, "철봉", Goal.EXERCISES, 8, false, Slot.group(Slot.Group.TALL)),
    // ── 러닝 트랙 전용
    CONE(Kind.DECOR, "트랙 콘", Goal.RUN_COUNT, 5, false, Slot.plus(Slot.group(Slot.Group.FIELD), Slot.TR_LINE)),
    WATER_STATION(Kind.DECOR, "음수대", Goal.RUN_KM, 50, false, Slot.group(Slot.Group.FIELD)),
    FINISH_FLAG(Kind.DECOR, "결승 깃발", Goal.RUN_KM, 100, false, Slot.TR_LINE),
    // ── 식당 전용
    RICE_COOKER(Kind.DECOR, "밥솥", Goal.DIET_DAYS, 21, false, Slot.group(Slot.Group.COUNTER)),
    SALAD_BAR(Kind.DECOR, "샐러드 바", Goal.MY_FOODS, 5, false, Slot.group(Slot.Group.SIDE)),
    MENU_BOARD(Kind.DECOR, "메뉴판", Goal.DIET_DAYS, 30, false, Slot.DN_WALL),

    // ── 테마(바닥 · 벽, 1층 · 2층에 같이)
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
    HAIR_BLOND(Kind.LOOK, "밝은 머리", null, 0, true, Slot.hairSlots()),

    // ── 새 공간(입구 포탈로 간다)
    SPACE_FLOOR2(Kind.SPACE, "헬스장 2층", Goal.DECOR_COUNT, 6, false),
    SPACE_TRACK(Kind.SPACE, "야외 러닝 트랙", Goal.RUN_KM, 30, false),
    SPACE_DINER(Kind.SPACE, "단백질 식당", Goal.DIET_DAYS, 14, false);

    public enum Kind { DECOR, THEME, STAFF, LOOK, SPACE }

    /** 공간. MAIN 은 1층(처음부터) */
    public enum Space {
        MAIN(null), FLOOR2("SPACE_FLOOR2"), TRACK("SPACE_TRACK"), DINER("SPACE_DINER");

        /** 열리는 조건이 되는 물품 코드 */
        public final String unlockItem;

        Space(String unlockItem) {
            this.unlockItem = unlockItem;
        }
    }

    /**
     * 꾸미기 자리. 위치 · 크기는 화면(decor.ts)이 정한다. defaultItem: 줄이 없을 때 놓여 있는 것.
     * group: 같은 크기 자리끼리 묶음(물품이 어느 자리에 들어가는지 정할 때 쓴다). space: 그 자리가 있는 공간.
     */
    public enum Slot {
        // 1층
        WALL(null, Space.MAIN, Group.WALL), PLATFORM_SIDE(null, Space.MAIN, null), CORNER_TOP("PLANT", Space.MAIN, Group.CORNER),
        FLOOR_LEFT(null, Space.MAIN, null), CENTER("RING_RED", Space.MAIN, null), CHECKIN_SIDE(null, Space.MAIN, null),
        COUNTER(null, Space.MAIN, null), CORNER_LEFT("PLANT", Space.MAIN, Group.CORNER), CORNER_RIGHT("PLANT", Space.MAIN, Group.CORNER),
        // 지도 밖 설정
        THEME("THEME_RUBBER", null, null), UNIFORM("UNIFORM_YELLOW", null, null),
        HIRE_TRAINER(null, null, null), HIRE_CLEANER(null, null, null), HIRE_TOWEL(null, null, null),
        HAIR_COACH("HAIR_BLACK", null, null), HAIR_OWNER("HAIR_GRAY", null, null), HAIR_STAFF("HAIR_BROWN", null, null),
        HAIR_TRAINER("HAIR_BLACK", null, null), HAIR_CLEANER("HAIR_BROWN", null, null), HAIR_TOWEL("HAIR_BLOND", null, null),
        // 2층
        F2_WALL_L(null, Space.FLOOR2, Group.WALL), F2_WALL_R(null, Space.FLOOR2, Group.WALL),
        F2_FLOOR_A(null, Space.FLOOR2, Group.FLOOR), F2_FLOOR_B(null, Space.FLOOR2, Group.FLOOR), F2_FLOOR_C(null, Space.FLOOR2, Group.FLOOR),
        F2_TALL_A(null, Space.FLOOR2, Group.TALL), F2_TALL_B(null, Space.FLOOR2, Group.TALL),
        F2_SIDE(null, Space.FLOOR2, Group.SIDE),
        F2_CORNER_L("PLANT", Space.FLOOR2, Group.CORNER), F2_CORNER_R("PLANT", Space.FLOOR2, Group.CORNER),
        // 러닝 트랙
        TR_FIELD_A(null, Space.TRACK, Group.FIELD), TR_FIELD_B(null, Space.TRACK, Group.FIELD),
        TR_FIELD_C(null, Space.TRACK, Group.FIELD), TR_FIELD_D(null, Space.TRACK, Group.FIELD),
        TR_LINE(null, Space.TRACK, null),
        // 식당
        DN_WALL(null, Space.DINER, null),
        DN_COUNTER_A(null, Space.DINER, Group.COUNTER), DN_COUNTER_B(null, Space.DINER, Group.COUNTER), DN_COUNTER_C(null, Space.DINER, Group.COUNTER),
        DN_SIDE_L(null, Space.DINER, Group.SIDE), DN_SIDE_R(null, Space.DINER, Group.SIDE),
        DN_CORNER_L("PLANT", Space.DINER, Group.CORNER), DN_CORNER_R("PLANT", Space.DINER, Group.CORNER);

        /** 같은 크기 자리 묶음: 벽(48×28) · 큰 바닥(48×36) · 키 큰 기구(32×34) · 구석(16×24) · 옆 자리(34×42) · 식당 조리대(32×28) · 트랙 안쪽 잔디(48×36) */
        public enum Group { WALL, FLOOR, TALL, CORNER, SIDE, COUNTER, FIELD }

        public final String defaultItem;
        public final Space space;
        public final Group group;

        Slot(String defaultItem, Space space, Group group) {
            this.defaultItem = defaultItem;
            this.space = space;
            this.group = group;
        }

        static Slot[] group(Group... groups) {
            Set<Group> want = EnumSet.noneOf(Group.class);
            want.addAll(List.of(groups));
            return java.util.Arrays.stream(values()).filter(s -> s.group != null && want.contains(s.group)).toArray(Slot[]::new);
        }

        static Slot[] plus(Slot[] base, Slot... more) {
            Slot[] out = java.util.Arrays.copyOf(base, base.length + more.length);
            System.arraycopy(more, 0, out, base.length, more.length);
            return out;
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
        RUN_COUNT("러닝 %d번"),
        DIET_DAYS("식단 기록 %d일"),
        MY_FOODS("내 음식 %d개 저장"),
        WEEKLY_STREAK("주간 목표 %d주 연속"),
        BODY("몸무게(체성분) 입력"),
        DECOR_COUNT("꾸미기 물품 %d개 얻기");

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
        this.slots.addAll(List.of(slots));
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
