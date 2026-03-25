package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "workout_crews")
public class WorkoutCrew extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 60)
    private String name;

    @Column(length = 300)
    private String description;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(unique = true, length = 20)
    private String inviteCode;

    @Enumerated(EnumType.STRING)
    @Column(length = 24)
    @Builder.Default
    private CrewJoinPolicy joinPolicy = CrewJoinPolicy.AUTO_APPROVE;
}
