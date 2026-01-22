package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.character.CharacterProfileResponse;
import com.ajou.muscleup.dto.event.EventProgressResponse;
import com.ajou.muscleup.dto.lounge.LoungeProfileResponse;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.AttendanceLogRepository;
import com.ajou.muscleup.repository.UserRepository;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class LoungeServiceImpl implements LoungeService {
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final UserRepository userRepository;
    private final AttendanceLogRepository attendanceLogRepository;
    private final CharacterService characterService;
    private final EventService eventService;

    @Override
    @Transactional(readOnly = true)
    public LoungeProfileResponse getProfile(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized"));

        LocalDate today = LocalDate.now(KST);
        LocalDate start = today.minusDays(29);
        int recentAttendanceCount = (int) attendanceLogRepository
                .countByUserAndDidWorkoutTrueAndDateBetween(user, start, today);
        CharacterProfileResponse character = characterService.getOrCreateProfile(email);
        List<EventProgressResponse> activeEvents = eventService.getActiveProgress(user, today);

        return LoungeProfileResponse.builder()
                .nickname(user.getNickname())
                .character(character)
                .recentAttendanceCount(recentAttendanceCount)
                .activeEvents(activeEvents)
                .build();
    }
}
