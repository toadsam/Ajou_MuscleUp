package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "character_evolution_history")
public class CharacterEvolutionHistory extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "trigger_type", nullable = false, length = 30)
    private CharacterEvolutionTriggerType triggerType;

    @Column(name = "before_level", nullable = false)
    private int beforeLevel;

    @Column(name = "after_level", nullable = false)
    private int afterLevel;

    @Enumerated(EnumType.STRING)
    @Column(name = "before_tier", nullable = false, length = 20)
    private CharacterTier beforeTier;

    @Enumerated(EnumType.STRING)
    @Column(name = "after_tier", nullable = false, length = 20)
    private CharacterTier afterTier;

    @Column(name = "before_stage", nullable = false)
    private int beforeStage;

    @Column(name = "after_stage", nullable = false)
    private int afterStage;
}
