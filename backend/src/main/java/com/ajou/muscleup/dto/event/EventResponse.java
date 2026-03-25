package com.ajou.muscleup.dto.event;

import com.ajou.muscleup.entity.Event;
import com.ajou.muscleup.entity.EventStatus;
import java.time.LocalDate;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class EventResponse {
    private Long id;
    private String title;
    private String description;
    private LocalDate startDate;
    private LocalDate endDate;
    private int requiredAttendanceCount;
    private EventStatus status;

    public static EventResponse from(Event event) {
        return EventResponse.builder()
                .id(event.getId())
                .title(event.getTitle())
                .description(event.getDescription())
                .startDate(event.getStartDate())
                .endDate(event.getEndDate())
                .requiredAttendanceCount(event.getRequiredAttendanceCount())
                .status(event.getStatus())
                .build();
    }
}
