package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.ClubRosterMember;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClubRosterMemberRepository extends JpaRepository<ClubRosterMember, Long> {
    List<ClubRosterMember> findAllByOrderBySortOrderAsc();
}
