package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import lombok.*;

/**
 * 오늘 할 일(출석 · 식단 1끼 · 응원 1번) 하루 기록. 보너스를 한 번만 주려고 "줬는지"를 남긴다.
 * 출석 · 식단은 원래 기록(AttendanceLog · MealEntry)으로 확인하고, 응원은 남는 기록이 없어 cheerDone 으로 센다.
 */
@Entity
@Table(name = "daily_quests",
        uniqueConstraints = @UniqueConstraint(name = "uk_daily_quest_day", columnNames = {"user_id", "quest_date"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DailyQuest extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "quest_date", nullable = false)
    private LocalDate questDate;

    @Column(name = "cheer_done", nullable = false)
    private boolean cheerDone;

    @Column(name = "diet_rewarded", nullable = false)
    private boolean dietRewarded;

    @Column(name = "cheer_rewarded", nullable = false)
    private boolean cheerRewarded;

    /** 단백질 목표 달성 보너스 */
    @Column(name = "protein_rewarded", nullable = false)
    private boolean proteinRewarded;

    /** 세 개 다 한 날 보너스 */
    @Column(name = "all_rewarded", nullable = false)
    private boolean allRewarded;
}
