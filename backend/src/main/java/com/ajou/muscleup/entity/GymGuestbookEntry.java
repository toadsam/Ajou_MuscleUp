package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * 홈 헬스장 방명록 — 친구가 내 헬스장에 놀러 와서 남긴 한 줄(60자).
 * 헬스장 주인과 주인의 친구만 본다. 주인 · 쓴 사람이 지울 수 있다. 탈퇴하면 주인 · 쓴 사람 쪽 모두 AccountDeletionService 가 지운다.
 */
@Entity
@Table(name = "gym_guestbook", indexes = {
        @Index(name = "idx_gym_guestbook_owner", columnList = "owner_id, id"),
        @Index(name = "idx_gym_guestbook_author", columnList = "author_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GymGuestbookEntry extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 헬스장 주인 */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    /** 남긴 사람 */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    @Column(nullable = false, length = 60)
    private String message;
}
