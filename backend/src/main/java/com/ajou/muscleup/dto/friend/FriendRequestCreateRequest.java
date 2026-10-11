package com.ajou.muscleup.dto.friend;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/** targetUserId(닉네임 검색 결과의 id) 또는 targetEmail 중 하나로 보낸다. 둘 다 있으면 id 를 쓴다. */
@Getter
@Setter
public class FriendRequestCreateRequest {
    @Positive
    private Long targetUserId;

    @Email
    @Size(max = 150)
    private String targetEmail;
}
