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
// (user_id, workout_date) UNIQUE 는 하루 두 번 출석을 막으려고 건 것인데,
// findByUserIdAndDateRange…(기간 조회)가 이 인덱스를 그대로 범위 스캔에 쓴다.
//
// 반면 findBySharedTrueOrderByReportCountDescUpdatedAtDesc(Pageable) — 공유된
// 인증글을 신고 많은 순으로 보는 관리자 화면 — 은 받쳐 줄 인덱스가 없었다.
@Table(
        name = "attendance_logs",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "workout_date"}),
        indexes = @Index(
                name = "idx_attendance_shared_report",
                columnList = "shared, report_count, updated_at"
        )
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

    @Column(name = "share_comment", length = 280)
    private String shareComment;

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
