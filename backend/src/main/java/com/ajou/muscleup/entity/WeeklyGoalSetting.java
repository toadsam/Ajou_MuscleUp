package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import lombok.*;

/** 주간 운동 목표(사용자당 하나): 한 주(월~일, 한국 시간)에 몇 번 운동할지. 없으면 기본 3번 */
@Entity
@Table(name = "weekly_goal_settings",
        uniqueConstraints = @UniqueConstraint(name = "uk_weekly_goal_setting_user", columnNames = "user_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WeeklyGoalSetting extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(nullable = false)
    private int target;
}
