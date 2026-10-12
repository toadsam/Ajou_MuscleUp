package com.ajou.muscleup.dto.attendance;

import com.ajou.muscleup.dto.character.CharacterChangeResponse;
import com.ajou.muscleup.dto.event.EventProgressResponse;
import com.ajou.muscleup.entity.AttendanceLog;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AttendanceLogResponse {
    private LocalDate date;
    private boolean didWorkout;
    private String memo;
    private String shareComment;
    private List<String> workoutTypes;
    private String workoutIntensity;
    private List<String> mediaUrls;
    private boolean shared;
    private String shareSlug;
    private int cheerCount;
    private int editCount;
    private LocalDateTime lastEditedAt;
    private LocalDateTime updatedAt;
    private Integer expEarned;
    private List<EventProgressResponse> eventProgress;
    private CharacterChangeResponse characterChange;
    /** 이번 출석으로 주간 목표를 처음 채웠으면 그 보너스(expEarned 에 이미 포함), 아니면 null */
    private Integer weeklyGoalBonus;
    /** 위와 함께: 연속 달성 주 수 */
    private Integer weeklyGoalStreak;
    /** 이번 출석으로 받은 보상 상자: WEEKLY_GOAL(주간 목표) · LUCKY(행운) · null */
    private String rewardBox;
    /** 이번 출석으로 새로 얻은 도감 업적(이름) */
    private List<String> unlockedItems;

    /** 도감 보상(CollectionService.onWorkoutDay)을 붙인다 */
    public AttendanceLogResponse withReward(String box, List<String> unlocked) {
        this.rewardBox = box;
        this.unlockedItems = unlocked;
        return this;
    }

    public static AttendanceLogResponse from(AttendanceLog log) {
        return AttendanceLogResponse.builder()
                .date(log.getDate())
                .didWorkout(log.isDidWorkout())
                .memo(log.getMemo())
                .shareComment(log.getShareComment())
                .workoutTypes(splitWorkoutTypes(log.getWorkoutTypes()))
                .workoutIntensity(log.getWorkoutIntensity())
                .mediaUrls(splitMediaUrls(log.getMediaUrls()))
                .shared(log.isShared())
                .shareSlug(log.getShareSlug())
                .cheerCount(log.getCheerCount())
                .editCount(log.getEditCount())
                .lastEditedAt(log.getLastEditedAt())
                .updatedAt(log.getUpdatedAt())
                .build();
    }

    public static AttendanceLogResponse from(
            AttendanceLog log,
            List<EventProgressResponse> eventProgress,
            CharacterChangeResponse characterChange,
            Integer expEarned,
            Integer weeklyGoalBonus,
            Integer weeklyGoalStreak
    ) {
        return AttendanceLogResponse.builder()
                .date(log.getDate())
                .didWorkout(log.isDidWorkout())
                .memo(log.getMemo())
                .shareComment(log.getShareComment())
                .workoutTypes(splitWorkoutTypes(log.getWorkoutTypes()))
                .workoutIntensity(log.getWorkoutIntensity())
                .mediaUrls(splitMediaUrls(log.getMediaUrls()))
                .shared(log.isShared())
                .shareSlug(log.getShareSlug())
                .cheerCount(log.getCheerCount())
                .editCount(log.getEditCount())
                .lastEditedAt(log.getLastEditedAt())
                .updatedAt(log.getUpdatedAt())
                .expEarned(expEarned)
                .eventProgress(eventProgress)
                .characterChange(characterChange)
                .weeklyGoalBonus(weeklyGoalBonus)
                .weeklyGoalStreak(weeklyGoalStreak)
                .build();
    }

    private static List<String> splitWorkoutTypes(String raw) {
        if (raw == null || raw.isBlank()) {
            return Collections.emptyList();
        }
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .toList();
    }

    private static List<String> splitMediaUrls(String raw) {
        if (raw == null || raw.isBlank()) {
            return Collections.emptyList();
        }
        return Arrays.stream(raw.split("\n"))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .toList();
    }
}
