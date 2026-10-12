package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

/** 브라우저 하나의 푸시 구독(기기마다 하나). endpoint 는 푸시 서비스 주소라 겹치지 않는다. */
@Entity
@Table(name = "push_subscriptions", uniqueConstraints = @UniqueConstraint(name = "uk_push_endpoint", columnNames = "endpoint_hash"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PushSubscription extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 1000)
    private String endpoint;

    /** endpoint 의 SHA-256(유일 제약용 — endpoint 가 길어 그대로는 인덱스가 어렵다) */
    @Column(name = "endpoint_hash", nullable = false, length = 64)
    private String endpointHash;

    @Column(nullable = false, length = 120)
    private String p256dh;

    @Column(nullable = false, length = 40)
    private String auth;

    @Column(name = "last_success_at")
    private LocalDateTime lastSuccessAt;
}
