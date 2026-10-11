package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false, length = 20)
    private String role = "USER";

    @Column(nullable = false, length = 30)
    private String nickname;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    /**
     * true 면 email 은 실제 주소가 아니라 내부용 자리 표시(예: kakao-123@users.musclehub.invalid).
     * 이메일을 주지 않는 소셜 로그인으로 가입한 경우. 메일을 보내지 않고 화면에 이메일로 보여 주지 않는다. null = false
     */
    @Column(name = "email_placeholder")
    private Boolean emailPlaceholder;

    /** 탈퇴한 시각. 탈퇴하면 개인정보를 지우고 이 행은 "탈퇴한 회원"으로 남는다(AccountDeletionService) */
    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    public boolean isDeleted() {
        return deletedAt != null;
    }

    public boolean hasRealEmail() {
        return !Boolean.TRUE.equals(emailPlaceholder);
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
