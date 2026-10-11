package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.WorkoutCrew;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface WorkoutCrewRepository extends JpaRepository<WorkoutCrew, Long> {
    Optional<WorkoutCrew> findByInviteCode(String inviteCode);

    boolean existsByInviteCode(String inviteCode);

    // 모임 목록용: 모임장(owner)을 함께 읽어 모임마다 owner 를 따로 조회하지 않는다.
    @Query("select c from WorkoutCrew c join fetch c.owner")
    List<WorkoutCrew> findAllWithOwner();
}
