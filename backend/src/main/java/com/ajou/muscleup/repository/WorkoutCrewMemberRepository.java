package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.entity.WorkoutCrew;
import com.ajou.muscleup.entity.WorkoutCrewMember;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkoutCrewMemberRepository extends JpaRepository<WorkoutCrewMember, Long> {
    Optional<WorkoutCrewMember> findByCrewAndUser(WorkoutCrew crew, User user);

    // 멤버마다 user 를 따로 읽지 않도록 함께 가져온다(N+1 방지).
    @EntityGraph(attributePaths = "user")
    List<WorkoutCrewMember> findAllByCrewOrderByCreatedAtAsc(WorkoutCrew crew);

    // 모임 목록용: 모임별 인원 수를 한 번에.
    @Query("select m.crew.id, count(m) from WorkoutCrewMember m group by m.crew.id")
    List<Object[]> countMembersGroupByCrewId();

    // 모임 목록용: 내가 들어간 모임 id 를 한 번에.
    @Query("select m.crew.id from WorkoutCrewMember m where m.user.id = :userId")
    List<Long> findCrewIdsByUserId(@Param("userId") Long userId);

    long countByCrew(WorkoutCrew crew);

    // 내 짐 목록용: 짐(crew)을 함께 읽는다
    @EntityGraph(attributePaths = "crew")
    List<WorkoutCrewMember> findAllByUser(User user);

    boolean existsByCrewAndUser(WorkoutCrew crew, User user);

    void deleteAllByCrew(WorkoutCrew crew);
}
