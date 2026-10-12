package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import lombok.*;

/**
 * 운동 기록 한 줄(종목 · 무게 · 횟수 · 세트). 개인 최고는 추정 1RM(e1rm)으로 비교한다.
 * 종목은 문자열 코드(LiftExercise) — enum 칸으로 두면 종목을 늘릴 때마다 DB 제약을 풀어야 해서.
 */
@Entity
@Table(name = "lift_entries", indexes = {
        @Index(name = "idx_lift_user_date", columnList = "user_id, performed_on"),
        @Index(name = "idx_lift_user_exercise", columnList = "user_id, exercise")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LiftEntry extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "performed_on", nullable = false)
    private LocalDate performedOn;

    @Column(nullable = false, length = 24)
    private String exercise;

    @Column(name = "weight_kg", nullable = false)
    private double weightKg;

    @Column(nullable = false)
    private int reps;

    @Column(nullable = false)
    private int sets;

    /** 추정 1RM(Epley) */
    @Column(nullable = false)
    private double e1rm;
}
