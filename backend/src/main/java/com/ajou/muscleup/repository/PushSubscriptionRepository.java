package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.PushSubscription;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {
    Optional<PushSubscription> findByEndpointHash(String endpointHash);

    List<PushSubscription> findAllByUser_IdOrderByIdAsc(Long userId);

    long countByUser_Id(Long userId);

    @Query("select distinct s.user.id from PushSubscription s")
    List<Long> findDistinctUserIds();
}
