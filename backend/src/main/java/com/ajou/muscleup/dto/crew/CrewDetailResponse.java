package com.ajou.muscleup.dto.crew;

import com.ajou.muscleup.entity.CrewJoinPolicy;
import com.ajou.muscleup.entity.WorkoutCrewMemberRole;
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
    // 모임 멤버(모임장 포함)에게만 채운다. 멤버가 아니면 null.
    private String inviteCode;
    private CrewJoinPolicy joinPolicy;
    private boolean joined;
    // 관리 화면을 볼 수 있는지(모임장 · 운영진 · 앱 운영자)
    private boolean leader;
    // 이 모임에서 내 역할(OWNER · STAFF · MEMBER), 멤버가 아니면 null
    private WorkoutCrewMemberRole myRole;
    private String month;
    private int targetDays;
    // 멤버가 아니어도 보이는 모임 전체 집계.
    private int memberCount;
    private long monthWorkoutTotal;
    private double averageAttendanceRate;
    // false 면 members · challenges[].members · kingTitles · competitionBoard 가 빈 목록이다(개인별 출석은 멤버만 본다).
    private boolean memberDetailVisible;
    private List<CrewMemberAttendanceResponse> members;
    private List<CrewChallengeResponse> challenges;
    private List<CrewKingTitleResponse> kingTitles;
    private List<CrewCompetitionEntryResponse> competitionBoard;
}
