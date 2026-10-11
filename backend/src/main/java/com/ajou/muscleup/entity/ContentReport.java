package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

/**
 * 게시물 · 댓글 · 공동구매 · 사용자 신고(이용약관 제10조). 같은 사람이 같은 대상을 두 번 신고할 수 없다.
 * snapshot 은 신고한 순간의 내용(작성자가 고치거나 지워도 운영자가 무엇이 신고됐는지 볼 수 있게).
 */
@Entity
@Table(name = "content_reports",
        uniqueConstraints = @UniqueConstraint(name = "uk_report_reporter_target", columnNames = {"reporter_id", "target_type", "target_id"}),
        indexes = @Index(name = "idx_report_status_created", columnList = "status, created_at"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContentReport extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reporter_id")
    private User reporter;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 20)
    private ReportTargetType targetType;

    @Column(name = "target_id", nullable = false)
    private Long targetId;

    /** 대상의 작성자(사용자 신고면 그 사람) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_user_id")
    private User targetUser;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReportReason reason;

    @Column(length = 500)
    private String detail;

    @Column(length = 500)
    private String snapshot;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReportStatus status;

    @Column(name = "admin_note", length = 500)
    private String adminNote;

    @Column(name = "handled_at")
    private LocalDateTime handledAt;
}
