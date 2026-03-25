package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.Event;
import com.ajou.muscleup.entity.EventStatus;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EventRepository extends JpaRepository<Event, Long> {
    List<Event> findAllByStatus(EventStatus status);

    List<Event> findAllByStartDateLessThanEqualAndEndDateGreaterThanEqual(
            LocalDate startDate,
            LocalDate endDate
    );
}
