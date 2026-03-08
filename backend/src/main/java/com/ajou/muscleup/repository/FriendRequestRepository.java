package com.ajou.muscleup.repository;

import com.ajou.muscleup.entity.FriendRequest;
import com.ajou.muscleup.entity.FriendRequestStatus;
import com.ajou.muscleup.entity.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FriendRequestRepository extends JpaRepository<FriendRequest, Long> {
    List<FriendRequest> findAllByReceiverAndStatusOrderByCreatedAtDesc(User receiver, FriendRequestStatus status);

    List<FriendRequest> findAllByRequesterAndStatusOrderByCreatedAtDesc(User requester, FriendRequestStatus status);

    Optional<FriendRequest> findByRequesterAndReceiverAndStatus(User requester, User receiver, FriendRequestStatus status);
}
