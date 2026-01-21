package com.ajou.muscleup.dto.attendance;

import com.ajou.muscleup.entity.AttendanceLog;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AttendanceLogResponse {
    private LocalDate date;
    private boolean didWorkout;
    private String memo;
    private LocalDateTime updatedAt;

    public static AttendanceLogResponse from(AttendanceLog log) {
        return AttendanceLogResponse.builder()
                .date(log.getDate())
                .didWorkout(log.isDidWorkout())
                .memo(log.getMemo())
                .updatedAt(log.getUpdatedAt())
                .build();
    }
}
