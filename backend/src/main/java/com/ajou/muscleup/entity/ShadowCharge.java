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
import java.time.LocalDate;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 그림자 던전의 "힘 모으기" 한 줄(docs/design/shadow-dungeon.md 3절). 운동 세션 · 러닝을 저장하면 기술(통)별로 한 줄씩 생긴다.
 * - skill: 힘이 들어간 통(LEGS · CHEST · BACK · ARMS · RUN) — 문자열(enum 칸 금지).
 * - raw: 환산한 힘(하루 상한 전), gained: 실제로 통에 들어간 힘(상한 뒤, 상한에 걸리면 0). "force" 는 MySQL 예약어라 쓰지 않는다. 하루 상한은 raw 의 합으로 센다(1차 shadow_hits 와 같은 규칙).
 * - critToken: 이 저장이 치명타 토큰을 줬는지(세션당 1개, 가장 큰 통의 줄에).
 * - 원본(세션 · 러닝)을 지우면 ShadowBossService.onDeleted 가 이 줄을 지우고 통에서 뺀다(이미 쓴 힘이면 피해를 깎는다).
 */
@Entity
@Table(name = "shadow_charges", indexes = {
        @Index(name = "idx_shadow_charge_source", columnList = "source, source_id"),
        @Index(name = "idx_shadow_charge_week", columnList = "week_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShadowCharge extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "week_id", nullable = false)
    private ShadowWeek week;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** SESSION · RUN (ShadowHit 의 상수) */
    @Column(nullable = false, length = 10)
    private String source;

    /** 그 세션 · 러닝의 id(외래키 아님) */
    @Column(name = "source_id", nullable = false)
    private Long sourceId;

    /** 통: LEGS · CHEST · BACK · ARMS · RUN (ShadowRules.SKILLS) */
    @Column(nullable = false, length = 10)
    private String skill;

    /** 모은 날(KST) — 하루 상한용 */
    @Column(name = "hit_on", nullable = false)
    private LocalDate hitOn;

    /** 환산한 힘(상한 전) */
    @Column(nullable = false)
    private int raw;

    /** 통에 실제로 들어간 힘(상한 뒤) */
    @Column(nullable = false)
    private int gained;

    /** 치명타 토큰을 준 줄인지 */
    @Column(name = "crit_token", nullable = false)
    private boolean critToken;
}
