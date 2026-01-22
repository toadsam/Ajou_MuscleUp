package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(
        name = "attendance_logs",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "workout_date"})
)
public class AttendanceLog extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "workout_date", nullable = false)
    private LocalDate date;

    @Column(name = "did_workout", nullable = false)
    private boolean didWorkout;

    @Column(length = 200)
    private String memo;

    @Column(name = "workout_types", length = 80)
    private String workoutTypes;

    @Column(name = "workout_intensity", length = 16)
    private String workoutIntensity;
}
