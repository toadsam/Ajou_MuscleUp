package com.ajou.muscleup.dto.event;

import com.ajou.muscleup.entity.EventParticipant;
import com.ajou.muscleup.entity.EventStatus;
import java.time.LocalDate;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class EventProgressResponse {
    private Long eventId;
    private String title;
    private LocalDate startDate;
    private LocalDate endDate;
    private int requiredAttendanceCount;
    private int currentAttendanceCount;
    private EventStatus status;
    private Boolean success;

    public static EventProgressResponse from(EventParticipant participant) {
        return EventProgressResponse.builder()
                .eventId(participant.getEvent().getId())
                .title(participant.getEvent().getTitle())
                .startDate(participant.getEvent().getStartDate())
                .endDate(participant.getEvent().getEndDate())
                .requiredAttendanceCount(participant.getEvent().getRequiredAttendanceCount())
                .currentAttendanceCount(participant.getCurrentAttendanceCount())
                .status(participant.getEvent().getStatus())
                .success(participant.getSuccess())
                .build();
    }
}
