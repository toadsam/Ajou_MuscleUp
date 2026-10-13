package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import lombok.*;

/** 알림 종류별 켜고 끄기(없으면 다 켬). */
@Entity
@Table(name = "push_preferences", uniqueConstraints = @UniqueConstraint(name = "uk_push_pref_user", columnNames = "user_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PushPreference {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** 저녁 출석 알림(연속 기록이 끊기기 전) */
    @Column(nullable = false)
    private boolean reminder;

    /** 주말 주간 목표 알림 */
    @Column(nullable = false)
    private boolean weekly;

    /** 응원 · 댓글 */
    @Column(nullable = false)
    private boolean social;
}
