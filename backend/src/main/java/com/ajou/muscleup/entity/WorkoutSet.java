package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import lombok.*;

/** 세션 안의 한 세트(끝낸 세트만 저장) */
@Entity
@Table(name = "workout_sets", indexes = @Index(name = "idx_workout_set_session", columnList = "session_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WorkoutSet {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private WorkoutSession session;

    /** 종목 코드(LiftExercise) */
    @Column(nullable = false, length = 24)
    private String exercise;

    /** 세션 안에서 몇 번째 종목인지 */
    @Column(name = "exercise_order", nullable = false)
    private int exerciseOrder;

    @Column(name = "set_order", nullable = false)
    private int setOrder;

    @Column(name = "weight_kg", nullable = false)
    private double weightKg;

    @Column(nullable = false)
    private int reps;
}
