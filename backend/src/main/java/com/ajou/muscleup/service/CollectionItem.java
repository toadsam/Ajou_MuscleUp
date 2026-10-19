package com.ajou.muscleup.service;

import java.util.Arrays;
import java.util.List;

/**
 * 도감에 모으는 것들. 코드는 저장되므로 바꾸지 않는다(새로 넣는 건 괜찮다).
 * - BOX: 보상 상자에서 나온다(같은 게 나오면 조각). 조각으로 만들 수도 있다.
 * - ACHIEVEMENT: 조건을 채우면 생긴다(상자에서는 안 나옴).
 * value: 칭호는 글자, 민소매는 색(#RRGGBB), 테두리는 화면이 쓰는 이름(plate-red 등).
 */
public enum CollectionItem {
    // ── 칭호: 업적
    T_FIRST_STEP(Category.TITLE, Rarity.COMMON, "첫 발걸음", "첫 발걸음", Achievement.ATTENDANCE_1),
    T_RUN_FIRST(Category.TITLE, Rarity.COMMON, "첫 러닝", "러너 입문", Achievement.RUN_1),
    T_SESSION_10(Category.TITLE, Rarity.RARE, "세트 장인", "세트 장인", Achievement.SESSION_10),
    T_REGULAR(Category.TITLE, Rarity.RARE, "꾸준러", "꾸준러", Achievement.ATTENDANCE_30),
    T_STREAK_4(Category.TITLE, Rarity.RARE, "4주 연속", "한 달 개근", Achievement.WEEKLY_STREAK_4),
    T_ACTIVITY_10(Category.TITLE, Rarity.RARE, "활동 Lv10", "부지런한 리프터", Achievement.ACTIVITY_10),
    T_MARATHON(Category.TITLE, Rarity.EPIC, "마라토너", "마라토너", Achievement.RUN_42K),
    T_IRON_HABIT(Category.TITLE, Rarity.EPIC, "쇠질 습관", "쇠질 습관", Achievement.ATTENDANCE_100),
    T_STREAK_12(Category.TITLE, Rarity.LEGENDARY, "석 달 개근", "석 달 개근", Achievement.WEEKLY_STREAK_12),
    T_ACTIVITY_25(Category.TITLE, Rarity.LEGENDARY, "득근 중독", "득근 중독", Achievement.ACTIVITY_25),
    T_SHADOW_1(Category.TITLE, Rarity.RARE, "그림자를 넘은 자", "그림자를 넘은 자", Achievement.SHADOW_1),
    T_SHADOW_STREAK_4(Category.TITLE, Rarity.EPIC, "그림자 사냥꾼", "그림자 사냥꾼", Achievement.SHADOW_STREAK_4),
    // ── 칭호: 상자
    T_DAWN(Category.TITLE, Rarity.COMMON, "새벽 헬스러", "새벽 헬스러", null),
    T_PROTEIN(Category.TITLE, Rarity.COMMON, "단백질 수집가", "단백질 수집가", null),
    T_FOAM_ROLLER(Category.TITLE, Rarity.COMMON, "폼롤러 장인", "폼롤러 장인", null),
    T_ROOKIE(Category.TITLE, Rarity.COMMON, "헬린이 졸업반", "헬린이 졸업반", null),
    T_PR_HUNTER(Category.TITLE, Rarity.RARE, "PR 사냥꾼", "PR 사냥꾼", null),
    T_PLATE_THIEF(Category.TITLE, Rarity.RARE, "원판 도둑", "원판 도둑", null),
    T_CHALK(Category.TITLE, Rarity.RARE, "초크 마법사", "초크 마법사", null),
    T_IRON_MASTER(Category.TITLE, Rarity.EPIC, "철판 마스터", "철판 마스터", null),
    T_LEGEND_SQUAT(Category.TITLE, Rarity.LEGENDARY, "전설의 스쿼터", "전설의 스쿼터", null),

    // ── 민소매 색: 상자
    K_BLACK(Category.TANK, Rarity.COMMON, "검정 민소매", "#1C1D21", null),
    K_WHITE(Category.TANK, Rarity.COMMON, "흰 민소매", "#E8E6E0", null),
    K_NAVY(Category.TANK, Rarity.COMMON, "남색 민소매", "#1F3A6B", null),
    K_GRAY(Category.TANK, Rarity.COMMON, "회색 민소매", "#6B7079", null),
    K_OLIVE(Category.TANK, Rarity.RARE, "올리브 민소매", "#5B6B2E", null),
    K_PURPLE(Category.TANK, Rarity.RARE, "보라 민소매", "#6B3FA0", null),
    K_PINK(Category.TANK, Rarity.RARE, "분홍 민소매", "#E07A9B", null),
    K_ORANGE(Category.TANK, Rarity.RARE, "주황 민소매", "#E8742A", null),
    K_CHAMPION(Category.TANK, Rarity.EPIC, "챔피언 레드", "#B3121B", null),
    K_GOLD(Category.TANK, Rarity.EPIC, "금빛 민소매", "#D4A72C", null),
    K_CHROME(Category.TANK, Rarity.LEGENDARY, "크롬 민소매", "#A9B1BC", null),

    // ── 카드 테두리: 상자
    F_RED(Category.FRAME, Rarity.COMMON, "빨간 원판 테두리", "plate-red", null),
    F_BLUE(Category.FRAME, Rarity.COMMON, "파란 원판 테두리", "plate-blue", null),
    F_YELLOW(Category.FRAME, Rarity.RARE, "노란 원판 테두리", "plate-yellow", null),
    F_GREEN(Category.FRAME, Rarity.RARE, "초록 원판 테두리", "plate-green", null),
    F_GOLD(Category.FRAME, Rarity.EPIC, "금테", "gold", null),
    F_HAZARD(Category.FRAME, Rarity.LEGENDARY, "출입 금지 테이프", "hazard", null),
    // ── 카드 테두리: 업적(그림자 8주 연속 — docs/design/shadow-dungeon-map.md 5절)
    F_SHADOW(Category.FRAME, Rarity.EPIC, "그림자 사냥 테두리", "shadow", Achievement.SHADOW_STREAK_8),

    // ── 몬스터 도감(보기만, 장착 없음): 던전 잡몹을 처음 잡으면 등록. value = 잡몹 코드(그림은 frontend components/dungeon/mobArt)
    M_TOMORROW(Category.MONSTER, Rarity.COMMON, "내일부터", "TOMORROW", Achievement.MOB_TOMORROW),
    M_MIDNIGHT_SNACK(Category.MONSTER, Rarity.COMMON, "야식 슬라임", "MIDNIGHT_SNACK", Achievement.MOB_MIDNIGHT_SNACK),
    M_SNOOZE(Category.MONSTER, Rarity.COMMON, "알람 스누즈", "SNOOZE", Achievement.MOB_SNOOZE),
    M_EXCUSE(Category.MONSTER, Rarity.RARE, "핑계", "EXCUSE", Achievement.MOB_EXCUSE),
    M_SOFA(Category.MONSTER, Rarity.EPIC, "소파 괴물", "SOFA", Achievement.MOB_SOFA);

    /** MONSTER: 몬스터 도감 카드(장착하지 않는다) */
    public enum Category { TITLE, TANK, FRAME, MONSTER }

    public enum Rarity {
        COMMON(60, 5, 30), RARE(28, 12, 80), EPIC(10, 30, 200), LEGENDARY(2, 80, 500);

        /** 상자에서 이 등급이 나올 가중치(합 100) */
        public final int weight;
        /** 이미 가진 걸 뽑았을 때 받는 조각 */
        public final int duplicateShards;
        /** 조각으로 만들 때 드는 조각 */
        public final int craftCost;

        Rarity(int weight, int duplicateShards, int craftCost) {
            this.weight = weight;
            this.duplicateShards = duplicateShards;
            this.craftCost = craftCost;
        }
    }

    /** 업적 조건(값 이상이면 달성) */
    public enum Achievement {
        ATTENDANCE_1("운동 출석 1번", 1),
        ATTENDANCE_30("운동 출석 30번", 30),
        ATTENDANCE_100("운동 출석 100번", 100),
        WEEKLY_STREAK_4("주간 목표 4주 연속", 4),
        WEEKLY_STREAK_12("주간 목표 12주 연속", 12),
        SESSION_10("운동 세션 10번", 10),
        RUN_1("러닝 1번", 1),
        RUN_42K("러닝 누적 42.195km", 42195),
        ACTIVITY_10("활동 레벨 10", 10),
        ACTIVITY_25("활동 레벨 25", 25),
        SHADOW_1("주간 보스 그림자 처치 1번", 1),
        SHADOW_STREAK_4("그림자 4주 연속 처치", 4),
        SHADOW_STREAK_8("그림자 8주 연속 처치", 8),
        MOB_TOMORROW("던전에서 '내일부터' 잡기", 1),
        MOB_MIDNIGHT_SNACK("던전에서 '야식 슬라임' 잡기", 1),
        MOB_SNOOZE("던전에서 '알람 스누즈' 잡기", 1),
        MOB_EXCUSE("던전에서 '핑계' 잡기", 1),
        MOB_SOFA("던전의 희귀 몬스터 '소파 괴물' 잡기", 1);

        public final String hint;
        public final int goal;

        Achievement(String hint, int goal) {
            this.hint = hint;
            this.goal = goal;
        }
    }

    public final Category category;
    public final Rarity rarity;
    public final String label;
    public final String value;
    public final Achievement achievement;

    CollectionItem(Category category, Rarity rarity, String label, String value, Achievement achievement) {
        this.category = category;
        this.rarity = rarity;
        this.label = label;
        this.value = value;
        this.achievement = achievement;
    }

    public boolean fromBox() {
        return achievement == null;
    }

    public static CollectionItem parse(String code) {
        if (code == null) return null;
        try {
            return valueOf(code.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public static List<CollectionItem> boxItems(Rarity rarity) {
        return Arrays.stream(values()).filter(i -> i.fromBox() && i.rarity == rarity).toList();
    }
}
