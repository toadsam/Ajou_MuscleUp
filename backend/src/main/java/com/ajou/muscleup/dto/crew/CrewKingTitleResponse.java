package com.ajou.muscleup.dto.crew;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CrewKingTitleResponse {
    private String title;
    private Long userId;
    private String nickname;
    private String metric;
}
