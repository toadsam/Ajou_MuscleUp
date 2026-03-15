package com.ajou.muscleup.dto.attendance;

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
public class AttendanceShareResponse {
    private Long id;
    private LocalDate date;
    private boolean didWorkout;
    private String memo;
    private List<String> workoutTypes;
    private String workoutIntensity;
    private List<String> mediaUrls;
    private String authorNickname;
    private int cheerCount;
    private int reportCount;
    private boolean hiddenByAdmin;
    private LocalDateTime lastEditedAt;
    private LocalDateTime updatedAt;
    private String shareSlug;

    public static AttendanceShareResponse from(AttendanceLog log) {
        return AttendanceShareResponse.builder()
                .id(log.getId())
                .date(log.getDate())
                .didWorkout(log.isDidWorkout())
                .memo(log.getMemo())
                .workoutTypes(split(log.getWorkoutTypes(), ","))
                .workoutIntensity(log.getWorkoutIntensity())
                .mediaUrls(split(log.getMediaUrls(), "\n"))
                .authorNickname(log.getUser() != null ? log.getUser().getNickname() : null)
                .cheerCount(log.getCheerCount())
                .reportCount(log.getReportCount())
                .hiddenByAdmin(log.isHiddenByAdmin())
                .lastEditedAt(log.getLastEditedAt())
                .updatedAt(log.getUpdatedAt())
                .shareSlug(log.getShareSlug())
                .build();
    }

    private static List<String> split(String raw, String sep) {
        if (raw == null || raw.isBlank()) {
            return Collections.emptyList();
        }
        return Arrays.stream(raw.split(sep))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }
}
