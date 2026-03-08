package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(
        name = "friend_chat_rooms",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_low_id", "user_high_id"})
)
public class FriendChatRoom extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_low_id", nullable = false)
    private User userLow;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_high_id", nullable = false)
    private User userHigh;
}
