package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.CrewChallenge;
import com.ajou.muscleup.entity.WorkoutCrew;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CrewChallengeRepository extends JpaRepository<CrewChallenge, Long> {
    List<CrewChallenge> findAllByCrewOrderByStartDateDesc(WorkoutCrew crew);
}
