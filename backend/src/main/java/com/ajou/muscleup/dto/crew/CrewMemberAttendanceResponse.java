package com.ajou.muscleup.dto.crew;

import com.ajou.muscleup.entity.CharacterTier;
import com.ajou.muscleup.entity.Gender;
import com.ajou.muscleup.entity.WorkoutCrewMemberRole;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CrewMemberAttendanceResponse {
    private Long userId;
    private String nickname;
    private WorkoutCrewMemberRole role;
    private long workoutDays;
    private int targetDays;
    private double attendanceRate;
    private CharacterTier characterTier;
    private Integer characterStage;
    private Integer characterLevel;
    private String avatarSeed;
    private Gender gender;
    @JsonProperty("isResting")
    private boolean isResting;
    /** 도감에서 장착한 민소매 색(없으면 null) */
    private String tank;
    /** 운동 직후 펌핑 중 */
    @JsonProperty("isPumped")
    private boolean isPumped;
    /** 몸 단계 0~5(AvatarLookService) */
    private int bodyStage;
}
