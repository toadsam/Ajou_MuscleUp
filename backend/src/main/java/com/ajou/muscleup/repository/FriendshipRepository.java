package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.Friendship;
import com.ajou.muscleup.entity.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FriendshipRepository extends JpaRepository<Friendship, Long> {
    Optional<Friendship> findByUserLowAndUserHigh(User userLow, User userHigh);

    @Query("select f from Friendship f where f.userLow = :user or f.userHigh = :user")
    List<Friendship> findAllByUser(@Param("user") User user);
}
