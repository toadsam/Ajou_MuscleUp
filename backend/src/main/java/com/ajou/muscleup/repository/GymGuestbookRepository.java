package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.GymGuestbookEntry;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GymGuestbookRepository extends JpaRepository<GymGuestbookEntry, Long> {
    @EntityGraph(attributePaths = "author")
    List<GymGuestbookEntry> findByOwner_IdOrderByIdDesc(Long ownerId, Pageable pageable);

    long countByOwner_IdAndAuthor_IdAndCreatedAtAfter(Long ownerId, Long authorId, LocalDateTime after);
}
