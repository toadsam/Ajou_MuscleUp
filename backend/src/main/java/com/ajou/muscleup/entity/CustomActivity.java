package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * 내가 추가한 운동 종류(필라테스 · 수영 등). "운동 시작"에서 헬스 · 러닝 옆에 같이 뜨고, 시간 + 메모만 간단히 기록한다.
 * 지워도 행은 남긴다(deleted) — 지난 기록의 이름을 계속 보여 주려고. 고르기 목록에서만 빠진다.
 */
@Entity
@Table(name = "custom_activities", indexes = @Index(name = "idx_custom_activity_user", columnList = "user_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CustomActivity extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 20)
    private String name;

    /** 출석 종류: WEIGHT(근력) · CARDIO(유산소) · STRETCH(스트레칭) */
    @Column(nullable = false, length = 10)
    private String category;

    @Column(nullable = false)
    private boolean deleted;
}
