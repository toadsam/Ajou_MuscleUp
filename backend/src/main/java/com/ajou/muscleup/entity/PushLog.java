package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.*;

/** 보낸 알림 기록 — 하루 2개 한도 계산용(30일 지나면 지운다). 내용은 남기지 않는다. */
@Entity
@Table(name = "push_logs", indexes = @Index(name = "idx_push_log_user_day", columnList = "user_id, sent_on"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PushLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "sent_on", nullable = false)
    private LocalDate sentOn;

    @Column(nullable = false, length = 12)
    private String type;

    @Column(name = "sent_at", nullable = false)
    private LocalDateTime sentAt;

    /** 실제로 전한 기기 수 */
    @Column(nullable = false)
    private int delivered;
}
