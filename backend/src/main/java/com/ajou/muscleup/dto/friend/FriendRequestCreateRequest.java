package com.ajou.muscleup.dto.friend;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FriendRequestCreateRequest {
    @NotBlank
    @Email
    private String targetEmail;
}
