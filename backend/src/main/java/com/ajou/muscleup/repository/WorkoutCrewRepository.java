package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.WorkoutCrew;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkoutCrewRepository extends JpaRepository<WorkoutCrew, Long> {
    Optional<WorkoutCrew> findByInviteCode(String inviteCode);

    boolean existsByInviteCode(String inviteCode);
}
