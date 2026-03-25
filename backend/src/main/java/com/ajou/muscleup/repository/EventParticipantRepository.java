package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.Event;
import com.ajou.muscleup.entity.EventParticipant;
import com.ajou.muscleup.entity.EventStatus;
import com.ajou.muscleup.entity.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EventParticipantRepository extends JpaRepository<EventParticipant, Long> {
    Optional<EventParticipant> findByUserAndEvent(User user, Event event);

    List<EventParticipant> findAllByEvent(Event event);

    @Query("""
            select ep from EventParticipant ep
            join fetch ep.event e
            where ep.user = :user
            and e.status = :status
            """)
    List<EventParticipant> findAllByUserAndEventStatus(@Param("user") User user, @Param("status") EventStatus status);
}
