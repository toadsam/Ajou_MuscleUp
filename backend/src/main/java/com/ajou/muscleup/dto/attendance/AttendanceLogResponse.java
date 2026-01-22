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
    private List<String> workoutTypes;
    private String workoutIntensity;
    private LocalDateTime updatedAt;
    private Integer expEarned;
    private List<EventProgressResponse> eventProgress;
    private CharacterChangeResponse characterChange;

    public static AttendanceLogResponse from(AttendanceLog log) {
        return AttendanceLogResponse.builder()
                .date(log.getDate())
                .didWorkout(log.isDidWorkout())
                .memo(log.getMemo())
                .workoutTypes(splitWorkoutTypes(log.getWorkoutTypes()))
                .workoutIntensity(log.getWorkoutIntensity())
                .updatedAt(log.getUpdatedAt())
                .build();
    }

    public static AttendanceLogResponse from(
            AttendanceLog log,
            List<EventProgressResponse> eventProgress,
            CharacterChangeResponse characterChange,
            Integer expEarned
    ) {
        return AttendanceLogResponse.builder()
                .date(log.getDate())
                .didWorkout(log.isDidWorkout())
                .memo(log.getMemo())
                .workoutTypes(splitWorkoutTypes(log.getWorkoutTypes()))
                .workoutIntensity(log.getWorkoutIntensity())
                .updatedAt(log.getUpdatedAt())
                .expEarned(expEarned)
                .eventProgress(eventProgress)
                .characterChange(characterChange)
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
}
