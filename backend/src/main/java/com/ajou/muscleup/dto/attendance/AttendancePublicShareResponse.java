package com.ajou.muscleup.dto.attendance;

import com.ajou.muscleup.entity.AttendanceLog;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import lombok.Builder;
import lombok.Getter;

/**
 * 로그인 없이 누구나 보는 출석 공유 화면용 응답.
 *
 * AttendanceShareResponse(작성자·관리자용)에서 공개하면 안 되는 값을 뺐다.
 * - id            : 내부 PK. 공개 화면은 shareSlug 로 충분하다.
 * - memo          : 본인용 메모. 공개 문구는 shareComment 로 따로 받는다.
 * - reportCount   : 신고 수. 운영 지표라 공개하지 않는다.
 * - hiddenByAdmin : 숨김 글은 애초에 404 라 필요 없다.
 */
@Getter
@Builder
public class AttendancePublicShareResponse {
    private LocalDate date;
    private boolean didWorkout;
    private String shareComment;
    private List<String> workoutTypes;
    private String workoutIntensity;
    private List<String> mediaUrls;
    private String authorNickname;
    private int cheerCount;
    private LocalDateTime lastEditedAt;
    private LocalDateTime updatedAt;
    private String shareSlug;
    private Integer currentStreak;

    public static AttendancePublicShareResponse from(AttendanceLog log, Integer currentStreak) {
        return AttendancePublicShareResponse.builder()
                .date(log.getDate())
                .didWorkout(log.isDidWorkout())
                .shareComment(log.getShareComment())
                .workoutTypes(split(log.getWorkoutTypes(), ","))
                .workoutIntensity(log.getWorkoutIntensity())
                .mediaUrls(split(log.getMediaUrls(), "\n"))
                .authorNickname(log.getUser() != null ? log.getUser().getNickname() : null)
                .cheerCount(log.getCheerCount())
                .lastEditedAt(log.getLastEditedAt())
                .updatedAt(log.getUpdatedAt())
                .shareSlug(log.getShareSlug())
                .currentStreak(currentStreak)
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
