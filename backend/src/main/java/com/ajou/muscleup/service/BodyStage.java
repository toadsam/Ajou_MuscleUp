package com.ajou.muscleup.service;

/**
 * 캐릭터 몸 단계 0~5(0 새싹 · 1 입문 · 2 근력 · 3 벌크 · 4 괴력 · 5 전설) — 화면의 치비 그림이 이 값으로 몸을 그린다
 * (docs/design/character-chibi.md 3절, frontend components/avatar/chibiArt.ts 와 같은 규칙).
 * 근육 데이터(인바디)가 없어도 운동하면 커지게, 셋 중 가장 높은 단계:
 *   - 근육량 muscularityNormalized(0~1) → 0~5
 *   - 캐릭터 레벨(1~100, 3대 · 체성분 · 출석) → 10 · 25 · 40 · 60 · 80 에서 한 단계씩
 *   - 활동 레벨(ActivityLevel, 출석 · 주간 목표 · 할 일 점수) → 3 · 6 · 10 · 15 · 22 에서 한 단계씩
 * 펌핑(운동 직후 1시간 +1)은 화면이 더한다(최대 5).
 */
public final class BodyStage {
    public static final int MAX = 5;
    static final int[] LEVEL_STEPS = {10, 25, 40, 60, 80};
    static final int[] ACTIVITY_STEPS = {3, 6, 10, 15, 22};

    private BodyStage() {}

    public static int of(double muscularityNormalized, int level, int activityLevel) {
        double m = Double.isFinite(muscularityNormalized) ? Math.max(0, Math.min(1, muscularityNormalized)) : 0;
        int fromMuscle = (int) Math.floor(m * 5.99);
        int fromLevel = count(LEVEL_STEPS, level);
        int fromActivity = count(ACTIVITY_STEPS, activityLevel);
        return Math.min(MAX, Math.max(fromMuscle, Math.max(fromLevel, fromActivity)));
    }

    private static int count(int[] steps, int value) {
        int n = 0;
        for (int s : steps) if (value >= s) n++;
        return n;
    }
}
