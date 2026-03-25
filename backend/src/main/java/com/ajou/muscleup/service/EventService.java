package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.event.EventProgressResponse;
import com.ajou.muscleup.dto.event.EventResponse;
import com.ajou.muscleup.entity.User;
import java.time.LocalDate;
import java.util.List;

public interface EventService {
    List<EventResponse> getActiveEvents(LocalDate date);

    List<EventProgressResponse> getActiveProgress(User user, LocalDate date);

    List<EventProgressResponse> updateAttendanceProgress(
            User user,
            LocalDate date,
            boolean previousDidWorkout,
            boolean currentDidWorkout
    );

    void refreshStatusesAndFinalize(LocalDate date);
}
