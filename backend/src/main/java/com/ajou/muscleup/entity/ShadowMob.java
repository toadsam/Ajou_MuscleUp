package com.ajou.muscleup.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 그림자 던전의 잡몹 한 마리 — 한 사람의 한 주(docs/design/shadow-dungeon-map.md 3 · 6절).
 * 주 행이 생길 때(또는 이번 주에 아직 없을 때) 시드로 4마리(+ 조건부 희귀 1) 만든다.
 * code 는 문자열(TOMORROW · MIDNIGHT_SNACK · SNOOZE · EXCUSE · SOFA — ShadowRules.MOBS, enum 칸 금지).
 * 잡몹에는 오버킬이 없다(남는 힘은 통으로 돌려준다). 처치 · 보상은 세션을 지워도 되돌리지 않는다.
 */
@Entity
@Table(name = "shadow_mobs", indexes = {
        @Index(name = "idx_shadow_mob_week", columnList = "week_id"),
        @Index(name = "idx_shadow_mob_user_code", columnList = "user_id, code")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShadowMob extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "week_id", nullable = false)
    private ShadowWeek week;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 20)
    private String code;

    /** 맵 자리 번호(0 부터, 화면이 방 · 위치로 바꾼다) */
    @Column(nullable = false)
    private int slot;

    @Column(nullable = false)
    private int hp;

    /** 들어간 힘(체력을 넘지 않는다) */
    @Column(nullable = false)
    private int damage;

    @Column(name = "killed_at")
    private LocalDateTime killedAt;
}
