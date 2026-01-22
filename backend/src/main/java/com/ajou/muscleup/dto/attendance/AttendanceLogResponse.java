package com.ajou.muscleup.dto.attendance;

import com.ajou.muscleup.dto.character.CharacterChangeResponse;
import com.ajou.muscleup.dto.event.EventProgressResponse;
import com.ajou.muscleup.entity.AttendanceLog;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AttendanceLogResponse {
    private LocalDate date;
    private boolean didWorkout;
    private String memo;
    private LocalDateTime updatedAt;
    private List<EventProgressResponse> eventProgress;
    private CharacterChangeResponse characterChange;

    public static AttendanceLogResponse from(AttendanceLog log) {
        return AttendanceLogResponse.builder()
                .date(log.getDate())
                .didWorkout(log.isDidWorkout())
                .memo(log.getMemo())
                .updatedAt(log.getUpdatedAt())
                .build();
    }

    public static AttendanceLogResponse from(
            AttendanceLog log,
            List<EventProgressResponse> eventProgress,
            CharacterChangeResponse characterChange
    ) {
        return AttendanceLogResponse.builder()
                .date(log.getDate())
                .didWorkout(log.isDidWorkout())
                .memo(log.getMemo())
                .updatedAt(log.getUpdatedAt())
                .eventProgress(eventProgress)
                .characterChange(characterChange)
                .build();
    }
}
