package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.*;

/**
 * 러닝 한 번. 서버에는 거리 · 시간 · 1km 구간 기록만 둔다 — 지나간 경로(위치)는 사용자 휴대폰에만 남긴다(사용자 결정, 위치정보 부담 줄이기).
 * 시각은 한국 시간(Clock 기준). 기록 비교용으로 가장 빠른 1km · 5km · 10km 를 저장할 때 미리 계산해 둔다.
 */
@Entity
@Table(name = "run_sessions", indexes = @Index(name = "idx_run_session_user_date", columnList = "user_id, performed_on"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RunSession extends BaseTimeEntity {
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

    /** 달린 시간(멈춘 시간 빼고) */
    @Column(name = "duration_sec", nullable = false)
    private int durationSec;

    @Column(name = "distance_m", nullable = false)
    private int distanceM;

    /** GPS(휴대폰으로 잰 것) · MANUAL(러닝머신 등 직접 입력 — 구간 없음, 속도 기록 비교 안 함) */
    @Column(nullable = false, length = 10)
    private String source;

    /** 1km 구간마다 걸린 초, 쉼표로("312,305,298") */
    @Column(length = 1000)
    private String splits;

    @Column(name = "best_1k_sec")
    private Integer best1kSec;

    @Column(name = "best_5k_sec")
    private Integer best5kSec;

    @Column(name = "best_10k_sec")
    private Integer best10kSec;

    /** 이 러닝으로 받은 기록 점수(하루 한도 계산용) */
    @Column(name = "record_points", nullable = false)
    private int recordPoints;

    @Column(length = 200)
    private String note;
}
