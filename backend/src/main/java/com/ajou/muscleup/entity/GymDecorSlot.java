package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * 홈 헬스장 꾸미기 — 꾸미기 자리(슬롯) 하나에 놓은 물품. 사람 × 자리마다 한 줄.
 * 줄이 없으면 그 자리의 기본 물품(화분 · 빨간 원)이 놓여 있는 것으로 본다. itemCode 가 null 이면 비워 둔 것.
 * 물품을 "얻었는지"는 저장하지 않고 기록에서 그때그때 계산한다(GymDecorService). 탈퇴하면 AccountDeletionService 가 지운다.
 */
@Entity
@Table(name = "gym_decor_slots",
        uniqueConstraints = @UniqueConstraint(name = "uk_gym_decor_user_slot", columnNames = {"user_id", "slot"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GymDecorSlot extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 20)
    private String slot;

    @Column(name = "item_code", length = 30)
    private String itemCode;
}
