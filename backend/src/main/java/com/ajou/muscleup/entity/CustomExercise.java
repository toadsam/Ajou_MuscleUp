package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * 내가 직접 추가한 종목(31개 기본 종목에 없는 것). 코드는 "C" + id(예: C12)로 운동 기록 · 세트에 그대로 쓴다.
 * 지워도 행은 남긴다(deleted) — 지난 기록의 이름을 계속 보여 주려고. 목록 · 고르기에서만 빠진다.
 */
@Entity
@Table(name = "custom_exercises", indexes = @Index(name = "idx_custom_exercise_user", columnList = "user_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CustomExercise extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 30)
    private String name;

    /** LiftExercise.Category 이름 또는 OTHER(기타) */
    @Column(nullable = false, length = 12)
    private String category;

    @Column(nullable = false)
    private boolean bodyweight;

    @Column(nullable = false)
    private boolean deleted;
}
