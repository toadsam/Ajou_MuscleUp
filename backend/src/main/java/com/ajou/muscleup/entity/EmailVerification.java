package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "email_verifications",
       indexes = @Index(name="idx_verif_email_created", columnList="email,createdAt"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class EmailVerification {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable=false, length=100)
    private String email;

    @Column(nullable=false, length=6)
    private String code;               // 6자리

    @Column(nullable=false)
    private LocalDateTime createdAt;

    @Column(nullable=false)
    private LocalDateTime expireAt;    // 생성 +10분

    @Column(nullable=false)
    private boolean verified;

    @Column(nullable=false)
    private int attempts;              // 실패 시도 횟수
}
