package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.event.EventProgressResponse;
import com.ajou.muscleup.dto.event.EventResponse;
import com.ajou.muscleup.entity.Event;
import com.ajou.muscleup.entity.EventParticipant;
import com.ajou.muscleup.entity.EventStatus;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.EventParticipantRepository;
import com.ajou.muscleup.repository.EventRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class EventServiceImpl implements EventService {
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final EventRepository eventRepository;
    private final EventParticipantRepository participantRepository;
    private final CharacterGrowthService characterGrowthService;

    @Override
    @Transactional(readOnly = true)
    public List<EventResponse> getActiveEvents(LocalDate date) {
        return eventRepository.findAllByStartDateLessThanEqualAndEndDateGreaterThanEqual(date, date)
                .stream()
                .map(EventResponse::from)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<EventProgressResponse> getActiveProgress(User user, LocalDate date) {
        List<EventParticipant> participants =
                participantRepository.findAllByUserAndEventStatus(user, EventStatus.ONGOING);
        return participants.stream()
                .filter(participant ->
                        !date.isBefore(participant.getEvent().getStartDate())
                                && !date.isAfter(participant.getEvent().getEndDate()))
                .map(EventProgressResponse::from)
                .toList();
    }

    @Override
    @Transactional
    public List<EventProgressResponse> updateAttendanceProgress(
            User user,
            LocalDate date,
            boolean previousDidWorkout,
            boolean currentDidWorkout
    ) {
        if (previousDidWorkout == currentDidWorkout) {
            return List.of();
        }
        int delta = currentDidWorkout ? 1 : -1;

        List<Event> events = eventRepository.findAllByStartDateLessThanEqualAndEndDateGreaterThanEqual(date, date);
        List<EventProgressResponse> progress = new ArrayList<>();
        for (Event event : events) {
            if (event.getStatus() != EventStatus.ONGOING) {
                event.setStatus(EventStatus.ONGOING);
                eventRepository.save(event);
            }
            EventParticipant participant = participantRepository.findByUserAndEvent(user, event)
                    .orElseGet(() -> participantRepository.save(EventParticipant.builder()
                            .user(user)
                            .event(event)
                            .joinedAt(LocalDateTime.now(KST))
                            .currentAttendanceCount(0)
                            .build()));
            int nextCount = Math.max(0, participant.getCurrentAttendanceCount() + delta);
            participant.setCurrentAttendanceCount(nextCount);
            progress.add(EventProgressResponse.from(participantRepository.save(participant)));
        }
        return progress;
    }

    @Override
    @Transactional
    public void refreshStatusesAndFinalize(LocalDate date) {
        List<Event> events = eventRepository.findAll();
        for (Event event : events) {
            EventStatus nextStatus = resolveStatus(event, date);
            boolean statusChanged = event.getStatus() != nextStatus;
            event.setStatus(nextStatus);
            eventRepository.save(event);

            if (statusChanged && nextStatus == EventStatus.FINISHED) {
                finalizeParticipants(event);
            }
        }
    }

    private void finalizeParticipants(Event event) {
        List<EventParticipant> participants = participantRepository.findAllByEvent(event);
        for (EventParticipant participant : participants) {
            boolean success = participant.getCurrentAttendanceCount() >= event.getRequiredAttendanceCount();
            participant.setSuccess(success);
            participantRepository.save(participant);
            if (success) {
                characterGrowthService.applyEventSuccess(participant.getUser(), event);
            }
        }
    }

    private EventStatus resolveStatus(Event event, LocalDate date) {
        if (date.isBefore(event.getStartDate())) {
            return EventStatus.UPCOMING;
        }
        if (date.isAfter(event.getEndDate())) {
            return EventStatus.FINISHED;
        }
        return EventStatus.ONGOING;
    }
}
