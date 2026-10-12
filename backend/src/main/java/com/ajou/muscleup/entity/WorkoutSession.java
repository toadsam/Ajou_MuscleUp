package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.*;

/**
 * 운동 세션 한 번(시작 ~ 끝). 진행 중인 세션은 화면(브라우저)이 들고 있다가 끝낼 때 한 번에 저장한다 — 서버에는 끝난 세션만.
 * 시각은 한국 시간(LocalDateTime, Clock 기준).
 */
@Entity
@Table(name = "workout_sessions", indexes = @Index(name = "idx_workout_session_user_date", columnList = "user_id, performed_on"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WorkoutSession extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "performed_on", nullable = false)
    private LocalDate performedOn;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "ended_at", nullable = false)
    private LocalDateTime endedAt;

    @Column(name = "duration_sec", nullable = false)
    private int durationSec;

    /** 총 볼륨 = Σ 무게 × 횟수(맨몸은 0) */
    @Column(name = "total_volume", nullable = false)
    private double totalVolume;

    @Column(name = "total_sets", nullable = false)
    private int totalSets;

    @Column(length = 200)
    private String note;

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("exerciseOrder asc, setOrder asc")
    @Builder.Default
    private List<WorkoutSet> sets = new ArrayList<>();
}
