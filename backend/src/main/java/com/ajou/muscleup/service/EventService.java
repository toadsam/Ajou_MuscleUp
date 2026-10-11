package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.event.EventProgressResponse;
import com.ajou.muscleup.dto.event.EventResponse;
import com.ajou.muscleup.entity.User;
import java.time.LocalDate;
import java.util.List;

public interface EventService {
    /** gymSlug 가 비면 앱 전체 + 공개 짐 + 내 짐의 이벤트, 있으면 그 짐 + 앱 전체 이벤트 */
    List<EventResponse> getActiveEvents(LocalDate date, String gymSlug, String viewerEmail);

    List<EventProgressResponse> getActiveProgress(User user, LocalDate date);

    List<EventProgressResponse> updateAttendanceProgress(
            User user,
            LocalDate date,
            boolean previousDidWorkout,
            boolean currentDidWorkout
    );

    void refreshStatusesAndFinalize(LocalDate date);
}
