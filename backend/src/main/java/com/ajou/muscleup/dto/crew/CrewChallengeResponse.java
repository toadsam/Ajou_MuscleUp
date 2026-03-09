package com.ajou.muscleup.dto.crew;

import java.time.LocalDate;
import java.util.List;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CrewChallengeResponse {
    private Long id;
    private String title;
    private String description;
    private LocalDate startDate;
    private LocalDate endDate;
    private String status;
    private int targetWorkoutDays;
    private List<CrewChallengeMemberProgressResponse> members;
}
