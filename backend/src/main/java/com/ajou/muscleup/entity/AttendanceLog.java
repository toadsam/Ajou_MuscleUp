package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
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

    @Column(name = "media_urls", length = 4000)
    private String mediaUrls;

    @Builder.Default
    @Column(name = "shared", nullable = false)
    private boolean shared = false;

    @Column(name = "share_slug", length = 64, unique = true)
    private String shareSlug;

    @Builder.Default
    @Column(name = "cheer_count", nullable = false)
    private int cheerCount = 0;

    @Builder.Default
    @Column(name = "report_count", nullable = false)
    private int reportCount = 0;

    @Builder.Default
    @Column(name = "hidden_by_admin", nullable = false)
    private boolean hiddenByAdmin = false;

    @Builder.Default
    @Column(name = "edit_count", nullable = false)
    private int editCount = 0;

    @Column(name = "last_edited_at")
    private LocalDateTime lastEditedAt;
}
