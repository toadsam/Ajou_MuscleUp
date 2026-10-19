package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;

/**
 * 주간 보스 "그림자" — 한 사람의 한 주(docs/design/shadow-boss.md 3절).
 * 체력(hp)은 지난 4주 힘 평균으로 월요일에(정확히는 그 주에 처음 볼 때) 정해지고, 이번 주 운동 · 러닝이 damage 로 쌓인다.
 * 행은 필요할 때(상태 조회 · 첫 충전) 만든다. 지워진 공격은 damage 를 다시 더하되 killed_at 은 그대로 둔다.
 * 2차(docs/design/shadow-dungeon.md): 저장은 공격이 아니라 "힘 모으기" — 기술(통)별 charge_* 에 쌓이고, 던전에서 strike 로 쓴다.
 * 안 쓴 힘은 주가 끝나면 자동 정산(settled). 1차 때 만들어진 행은 settled 기본값 true(이미 공격이 들어간 주).
 */
@Entity
@Table(name = "shadow_weeks",
        uniqueConstraints = @UniqueConstraint(name = "uk_shadow_week", columnNames = {"user_id", "week_start"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShadowWeek extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** 그 주 월요일(KST) */
    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    /** 그림자 체력 = max(100, round(최근 4주 힘 평균 × 1.05)) */
    @Column(nullable = false)
    private int hp;

    /** 이번 주에 들어간 힘 합계(치명타 배율 포함) */
    @Column(nullable = false)
    private int damage;

    /** 공격 횟수 */
    @Column(nullable = false)
    private int hits;

    /** 치명타 횟수 */
    @Column(nullable = false)
    private int crits;

    /** 처치한 시각(null 이면 아직). 공격을 지워도 되돌리지 않는다 */
    @Column(name = "killed_at")
    private LocalDateTime killedAt;

    /** 처치 보상(점수 · 상자 · 칭호)을 줬는지 — 한 주 한 번 */
    @Column(nullable = false)
    private boolean rewarded;

    /** 주가 시작될 때 캐릭터 레벨(치명타 배율용, 주 안에서는 고정) */
    @Column(name = "level_at_start", nullable = false)
    private int levelAtStart;

    /** 휴식 주(WeeklyGoalWeek.rest 를 따라감): 데미지는 쌓이되 처치되지 않고 연속도 끊기지 않는다 */
    @Column(nullable = false)
    private boolean rest;

    // ---- 2차 던전: 아직 안 쓴 힘(기술별 통) · 치명타 토큰 · 정산 ----
    @ColumnDefault("0")
    @Column(name = "charge_legs", nullable = false)
    private int chargeLegs;
    @ColumnDefault("0")
    @Column(name = "charge_chest", nullable = false)
    private int chargeChest;
    @ColumnDefault("0")
    @Column(name = "charge_back", nullable = false)
    private int chargeBack;
    @ColumnDefault("0")
    @Column(name = "charge_arms", nullable = false)
    private int chargeArms;
    @ColumnDefault("0")
    @Column(name = "charge_run", nullable = false)
    private int chargeRun;
    /** 아직 안 쓴 치명타 토큰(PR 이 나온 저장마다 1개) */
    @ColumnDefault("0")
    @Column(name = "crit_tokens", nullable = false)
    private int critTokens;
    /** 주가 끝나 남은 힘을 자동 공격으로 정산했는지(이번 주는 false). 1차 행은 true */
    @ColumnDefault("true")
    @Column(nullable = false)
    private boolean settled;
    /** 던전에 들어온 횟수(통계용) */
    @ColumnDefault("0")
    @Column(nullable = false)
    private int visits;
    /** 잡몹에 쓴 힘(보너스 전) — 다음 주 체력 계산에 보스 피해와 함께 센다(그 주에 한 운동량) */
    @ColumnDefault("0")
    @Column(name = "mob_force", nullable = false)
    private int mobForce;

    /** 그 통에 남은 힘 */
    public int charge(String skill) {
        return switch (skill) {
            case "LEGS" -> chargeLegs;
            case "CHEST" -> chargeChest;
            case "BACK" -> chargeBack;
            case "ARMS" -> chargeArms;
            case "RUN" -> chargeRun;
            default -> 0;
        };
    }

    /** 통에 더하거나(양수) 뺀다(음수). 0 아래로는 내려가지 않는다 */
    public void addCharge(String skill, int delta) {
        switch (skill) {
            case "LEGS" -> chargeLegs = Math.max(0, chargeLegs + delta);
            case "CHEST" -> chargeChest = Math.max(0, chargeChest + delta);
            case "BACK" -> chargeBack = Math.max(0, chargeBack + delta);
            case "ARMS" -> chargeArms = Math.max(0, chargeArms + delta);
            case "RUN" -> chargeRun = Math.max(0, chargeRun + delta);
            default -> { }
        }
    }

    /** 다섯 통의 합 */
    public int chargeTotal() {
        return chargeLegs + chargeChest + chargeBack + chargeArms + chargeRun;
    }
}
