package com.ajou.muscleup.dto.crew;

import com.ajou.muscleup.entity.CrewJoinPolicy;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CrewListItemResponse {
    private Long id;
    private String name;
    private String description;
    private String ownerNickname;
    private long memberCount;
    private boolean joined;
    private String inviteCode;
    private CrewJoinPolicy joinPolicy;
}
