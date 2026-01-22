package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.character.CharacterChangeResponse;
import com.ajou.muscleup.entity.CharacterEvolutionTriggerType;
import com.ajou.muscleup.entity.CharacterProfile;
import com.ajou.muscleup.entity.Event;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.UserBodyStats;
import com.ajou.muscleup.repository.AttendanceLogRepository;
import com.ajou.muscleup.repository.CharacterProfileRepository;
import com.ajou.muscleup.repository.UserBodyStatsRepository;
import java.time.LocalDate;
import java.time.ZoneId;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CharacterGrowthService {
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final CharacterService characterService;
    private final CharacterProfileRepository profileRepository;
    private final UserBodyStatsRepository statsRepository;
    private final AttendanceLogRepository attendanceLogRepository;

    @Transactional
    public CharacterChangeResponse applyAttendance(User user, boolean previousDidWorkout, boolean currentDidWorkout) {
        if (previousDidWorkout == currentDidWorkout) {
            return null;
        }
        CharacterProfile profile = profileRepository.findByUser(user)
                .orElseGet(() -> profileRepository.save(CharacterServiceImpl.defaultProfileStatic(user)));
        int delta = currentDidWorkout ? 1 : -1;
        int points = Math.max(0, profile.getAttendancePoints() + delta);

        if (currentDidWorkout) {
            int streak = calculateCurrentStreak(user, LocalDate.now(KST));
            if (streak >= 7) {
                points += 2;
            } else if (streak >= 3) {
                points += 1;
            }
        }

        profile.setAttendancePoints(points);
        profileRepository.save(profile);

        UserBodyStats stats = statsRepository.findByUser(user).orElse(null);
        if (stats == null) {
            return null;
        }

        return characterService.evaluate(user.getEmail(), CharacterEvolutionTriggerType.ATTENDANCE)
                .getChange();
    }

    @Transactional
    public CharacterChangeResponse applyEventSuccess(User user, Event event) {
        CharacterProfile profile = profileRepository.findByUser(user)
                .orElseGet(() -> profileRepository.save(CharacterServiceImpl.defaultProfileStatic(user)));
        profile.setAttendancePoints(profile.getAttendancePoints() + 10);
        profileRepository.save(profile);

        UserBodyStats stats = statsRepository.findByUser(user).orElse(null);
        if (stats == null) {
            return null;
        }
        return characterService.evaluate(user.getEmail(), CharacterEvolutionTriggerType.EVENT_SUCCESS)
                .getChange();
    }

    private int calculateCurrentStreak(User user, LocalDate today) {
        var todayLog = attendanceLogRepository.findByUserAndDate(user, today).orElse(null);
        if (todayLog != null && !todayLog.isDidWorkout()) {
            return 0;
        }

        LocalDate cursor = (todayLog != null) ? today : today.minusDays(1);
        int streak = 0;
        while (true) {
            var log = attendanceLogRepository.findByUserAndDate(user, cursor).orElse(null);
            if (log == null || !log.isDidWorkout()) {
                break;
            }
            streak += 1;
            cursor = cursor.minusDays(1);
        }
        return streak;
    }
}
