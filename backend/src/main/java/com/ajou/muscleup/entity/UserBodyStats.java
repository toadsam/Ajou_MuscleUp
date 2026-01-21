package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(
        name = "user_body_stats",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id"})
)
public class UserBodyStats extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "height_cm")
    private Integer heightCm;

    @Column(name = "weight_kg", nullable = false)
    private Double weightKg;

    @Column(name = "skeletal_muscle_kg")
    private Double skeletalMuscleKg;

    @Column(name = "bench_kg")
    private Double benchKg;

    @Column(name = "squat_kg")
    private Double squatKg;

    @Column(name = "deadlift_kg")
    private Double deadliftKg;
}
