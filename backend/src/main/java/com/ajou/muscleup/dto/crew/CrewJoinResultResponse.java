package com.ajou.muscleup.dto.crew;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CrewJoinResultResponse {
    private Long crewId;
    private String crewName;
    private String inviteCode;
    private String result;
    private String message;
}
