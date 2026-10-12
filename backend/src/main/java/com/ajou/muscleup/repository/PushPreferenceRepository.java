package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.PushPreference;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PushPreferenceRepository extends JpaRepository<PushPreference, Long> {
    Optional<PushPreference> findByUser_Id(Long userId);
}
