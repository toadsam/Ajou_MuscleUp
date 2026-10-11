package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * 소셜 로그인 계정 ↔ 우리 사용자 연결. "Google 의 몇 번 회원 / 카카오의 몇 번 회원"으로 사용자를 찾는다.
 * 예전에는 Google 이메일로만 찾아, 이메일을 주지 않는 카카오는 붙일 수 없었다(docs/design/stage0-gyms.md §3).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(
        name = "social_accounts",
        uniqueConstraints = @UniqueConstraint(columnNames = {"provider", "provider_user_id"})
)
public class SocialAccount extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private SocialProvider provider;

    /** 공급자가 주는 회원 고유 번호(Google sub · 카카오 회원번호) */
    @Column(name = "provider_user_id", nullable = false, length = 64)
    private String providerUserId;

    /** 연결할 때 공급자가 알려 준 이메일(참고용, 없을 수 있음) */
    @Column(name = "email_at_link", length = 100)
    private String emailAtLink;
}
