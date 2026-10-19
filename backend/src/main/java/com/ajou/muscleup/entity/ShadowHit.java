package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;

/**
 * 그림자에게 한 공격 한 번. 되감기 · 지우기용.
 * source 는 문자열 — enum 칸을 쓰지 않는다(DB 제약 이전이 필요 없게, CLAUDE.md 함정).
 *   1차: SESSION · RUN(저장이 곧 공격, source_id = 세션 · 러닝 id).
 *   2차(docs/design/shadow-dungeon.md): DUNGEON(던전에서 기술로 한 타, skill · grade 있음) · SETTLE(주 끝 자동 정산). source_id 는 0.
 *   충전(힘 모으기)은 ShadowCharge 가 따로 적는다 — 삭제 재계산은 그쪽 기준.
 * hit_on 은 공격한 날(KST, Clock) — 하루 상한을 셀 때 쓴다(created_at 은 서버 시계라 테스트 · 시간대에 흔들린다).
 */
@Entity
@Table(name = "shadow_hits", indexes = {
        @Index(name = "idx_shadow_hit_source", columnList = "source, source_id"),
        @Index(name = "idx_shadow_hit_week", columnList = "week_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShadowHit extends BaseTimeEntity {
    public static final String SESSION = "SESSION";
    public static final String RUN = "RUN";
    public static final String DUNGEON = "DUNGEON";
    public static final String SETTLE = "SETTLE";
    /** 잡몹을 친 타 — 응답에만 쓰고 이 표에는 넣지 않는다(잡몹 피해는 shadow_mobs.damage, 보스 합계와 섞지 않음) */
    public static final String MOB = "MOB";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "week_id", nullable = false)
    private ShadowWeek week;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** SESSION · RUN */
    @Column(nullable = false, length = 10)
    private String source;

    /** 그 세션 · 러닝의 id(외래키 아님 — 원본을 지우면 onDeleted 로 같이 지운다) */
    @Column(name = "source_id", nullable = false)
    private Long sourceId;

    /** 공격한 날(KST) */
    @Column(name = "hit_on", nullable = false)
    private LocalDate hitOn;

    /** 환산한 힘(상한 · 치명타 전) */
    @Column(nullable = false)
    private int raw;

    /** 실제로 들어간 힘(하루 상한 · 치명타 배율 뒤). 상한에 걸리면 0 */
    @Column(nullable = false)
    private int damage;

    @Column(nullable = false)
    private boolean crit;

    /** 이 공격 뒤 남은 체력(0 아래로는 내려가지 않음) */
    @Column(name = "hp_after", nullable = false)
    private int hpAfter;

    // ---- 2차 던전 ----
    /** 쓴 기술(통): LEGS · CHEST · BACK · ARMS · RUN. 1차 공격 · 자동 정산이면 null */
    @Column(length = 10)
    private String skill;
    /** 타이밍 등급: PERFECT · GOOD · MISS. 던전 타가 아니면 null */
    @Column(length = 10)
    private String grade;
    /** 타이밍 + 패시브로 더해진 힘(damage 에 이미 포함, 치명타 배율 전) */
    @ColumnDefault("0")
    @Column(nullable = false)
    private int bonus;
}
