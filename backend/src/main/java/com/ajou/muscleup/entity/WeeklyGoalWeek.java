package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import lombok.*;

/**
 * 한 주의 목표 기록. 그 주에 처음 운동했을 때(또는 목표 · 쉬는 주를 바꿀 때) 만든다.
 * target 은 그 주에 적용된 목표 — 주 중간에 목표를 낮춰 연속을 지키지 못하게, 운동한 뒤에 바꾼 목표는 다음 주부터.
 * 행이 없는 주(이 기능 전 · 운동 안 한 주)는 지금 설정한 목표로 본다.
 */
@Entity
@Table(name = "weekly_goal_weeks",
        uniqueConstraints = @UniqueConstraint(name = "uk_weekly_goal_week", columnNames = {"user_id", "week_start"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WeeklyGoalWeek extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** 그 주 월요일 */
    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    @Column(nullable = false)
    private int target;

    /** 쉬는 주: 연속이 끊기지 않는다(세지도 않는다) */
    @Column(nullable = false)
    private boolean rest;

    /** 달성 보너스를 이미 줬는지(한 주에 한 번) */
    @Column(nullable = false)
    private boolean rewarded;
}
