package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.CrewJoinRequestStatus;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.WorkoutCrew;
import com.ajou.muscleup.entity.WorkoutCrewJoinRequest;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkoutCrewJoinRequestRepository extends JpaRepository<WorkoutCrewJoinRequest, Long> {
    Optional<WorkoutCrewJoinRequest> findByCrewAndUser(WorkoutCrew crew, User user);

    Optional<WorkoutCrewJoinRequest> findByIdAndCrew(Long id, WorkoutCrew crew);

    List<WorkoutCrewJoinRequest> findAllByCrewAndStatusOrderByCreatedAtAsc(WorkoutCrew crew, CrewJoinRequestStatus status);

    boolean existsByCrewAndUserAndStatus(WorkoutCrew crew, User user, CrewJoinRequestStatus status);

    void deleteAllByCrew(WorkoutCrew crew);
}
