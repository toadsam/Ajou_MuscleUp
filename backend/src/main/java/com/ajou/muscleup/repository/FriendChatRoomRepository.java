package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.FriendChatRoom;
import com.ajou.muscleup.entity.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FriendChatRoomRepository extends JpaRepository<FriendChatRoom, Long> {
    Optional<FriendChatRoom> findByUserLowAndUserHigh(User userLow, User userHigh);

    @Query("select r from FriendChatRoom r where r.userLow = :user or r.userHigh = :user order by r.updatedAt desc")
    List<FriendChatRoom> findAllByUser(@Param("user") User user);
}
