package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.*;

/**
 * 주간 보스 "그림자" — 한 사람의 한 주(docs/design/shadow-boss.md 3절).
 * 체력(hp)은 지난 4주 힘 평균으로 월요일에(정확히는 그 주에 처음 볼 때) 정해지고, 이번 주 운동 · 러닝이 damage 로 쌓인다.
 * 행은 필요할 때(상태 조회 · 첫 공격) 만든다 — 스케줄러 없음. 지워진 공격은 damage 를 다시 더하되 killed_at 은 그대로 둔다.
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
}
