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
public class AdminAttendanceLogResponse {
    private Long id;
    private Long userId;
    private String userEmail;
    private String userNickname;
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
    private int reportCount;
    private boolean hiddenByAdmin;
    private int editCount;
    private LocalDateTime lastEditedAt;
    private LocalDateTime updatedAt;

    public static AdminAttendanceLogResponse from(AttendanceLog log) {
        return AdminAttendanceLogResponse.builder()
                .id(log.getId())
                .userId(log.getUser() != null ? log.getUser().getId() : null)
                .userEmail(log.getUser() != null ? log.getUser().getEmail() : null)
                .userNickname(log.getUser() != null ? log.getUser().getNickname() : null)
                .date(log.getDate())
                .didWorkout(log.isDidWorkout())
                .memo(log.getMemo())
                .shareComment(log.getShareComment())
                .workoutTypes(split(log.getWorkoutTypes(), ","))
                .workoutIntensity(log.getWorkoutIntensity())
                .mediaUrls(split(log.getMediaUrls(), "\n"))
                .shared(log.isShared())
                .shareSlug(log.getShareSlug())
                .cheerCount(log.getCheerCount())
                .reportCount(log.getReportCount())
                .hiddenByAdmin(log.isHiddenByAdmin())
                .editCount(log.getEditCount())
                .lastEditedAt(log.getLastEditedAt())
                .updatedAt(log.getUpdatedAt())
                .build();
    }

    private static List<String> split(String raw, String separator) {
        if (raw == null || raw.isBlank()) {
            return Collections.emptyList();
        }
        return Arrays.stream(raw.split(separator))
                .map(String::trim)
                .filter(v -> !v.isEmpty())
                .toList();
    }
}
