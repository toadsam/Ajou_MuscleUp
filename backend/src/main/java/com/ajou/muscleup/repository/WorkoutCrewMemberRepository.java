package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.WorkoutCrew;
import com.ajou.muscleup.entity.WorkoutCrewMember;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkoutCrewMemberRepository extends JpaRepository<WorkoutCrewMember, Long> {
    Optional<WorkoutCrewMember> findByCrewAndUser(WorkoutCrew crew, User user);

    List<WorkoutCrewMember> findAllByCrewOrderByCreatedAtAsc(WorkoutCrew crew);

    long countByCrew(WorkoutCrew crew);

    boolean existsByCrewAndUser(WorkoutCrew crew, User user);

    void deleteAllByCrew(WorkoutCrew crew);
}
