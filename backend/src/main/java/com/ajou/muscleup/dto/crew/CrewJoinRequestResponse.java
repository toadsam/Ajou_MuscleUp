package com.ajou.muscleup.dto.crew;

import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CrewJoinRequestResponse {
    private Long id;
    private Long userId;
    private String nickname;
    private String email;
    private String status;
    private LocalDateTime requestedAt;
}
