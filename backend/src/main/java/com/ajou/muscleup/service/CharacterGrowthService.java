package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.character.CharacterChangeResponse;
import com.ajou.muscleup.entity.CharacterEvolutionTriggerType;
import com.ajou.muscleup.entity.CharacterProfile;
import com.ajou.muscleup.entity.Event;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.UserBodyStats;
import com.ajou.muscleup.repository.CharacterProfileRepository;
import com.ajou.muscleup.repository.UserBodyStatsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CharacterGrowthService {
    private final CharacterService characterService;
    private final CharacterProfileRepository profileRepository;
    private final UserBodyStatsRepository statsRepository;

    @Transactional
    public CharacterChangeResponse applyAttendance(User user, int pointsEarned) {
        if (pointsEarned == 0) {
            return null;
        }
        CharacterProfile profile = profileRepository.findByUser(user)
                .orElseGet(() -> profileRepository.save(CharacterServiceImpl.defaultProfileStatic(user)));
        int points = Math.max(0, profile.getAttendancePoints() + pointsEarned);
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

}
