package com.ajou.muscleup.dto.crew;

import com.ajou.muscleup.entity.CrewJoinPolicy;
import java.util.List;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CrewDetailResponse {
    private Long id;
    private String name;
    private String description;
    private String ownerNickname;
    private String inviteCode;
    private CrewJoinPolicy joinPolicy;
    private boolean joined;
    private boolean leader;
    private String month;
    private int targetDays;
    private List<CrewMemberAttendanceResponse> members;
    private List<CrewChallengeResponse> challenges;
    private List<CrewKingTitleResponse> kingTitles;
    private List<CrewCompetitionEntryResponse> competitionBoard;
}
