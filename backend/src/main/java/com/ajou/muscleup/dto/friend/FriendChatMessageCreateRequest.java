package com.ajou.muscleup.dto.friend;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FriendChatMessageCreateRequest {
    @NotBlank
    @Size(max = 1000)
    private String content;
}
