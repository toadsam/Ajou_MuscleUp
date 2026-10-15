package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.*;

/** 내가 추가한 운동(CustomActivity) 한 번 — 시간 + 메모만. 시각은 한국 시간(Clock 기준). */
@Entity
@Table(name = "activity_logs", indexes = @Index(name = "idx_activity_log_user_date", columnList = "user_id, performed_on"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ActivityLog extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "activity_id", nullable = false)
    private CustomActivity activity;

    @Column(name = "performed_on", nullable = false)
    private LocalDate performedOn;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "duration_sec", nullable = false)
    private int durationSec;

    @Column(length = 200)
    private String note;
}
