package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "refresh_tokens")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class RefreshToken extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    /**
     * 리프레시 토큰의 SHA-256 해시(16진수 64자). 원문은 쿠키에만 있고 DB 에는 남기지 않는다.
     * (이번 변경 전에 만든 행은 원문 JWT 가 들어 있다. 첫 갱신 때 해시 행으로 바뀐다)
     */
    @Column(nullable = false, unique = true, length = 512)
    private String token;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    /** 갱신(회전)으로 폐기된 시각. null 이면 아직 쓸 수 있는 토큰. */
    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    /** 이 토큰을 대신하는 새 토큰의 해시. 폐기된 토큰이 다시 들어오면 재사용(탈취) 판단에 쓴다. */
    @Column(name = "replaced_by", length = 128)
    private String replacedBy;
}

