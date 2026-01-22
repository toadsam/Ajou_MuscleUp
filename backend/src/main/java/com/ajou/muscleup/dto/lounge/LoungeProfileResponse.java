package com.ajou.muscleup.dto.lounge;

import com.ajou.muscleup.dto.character.CharacterProfileResponse;
import com.ajou.muscleup.dto.event.EventProgressResponse;
import java.util.List;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class LoungeProfileResponse {
    private String nickname;
    private CharacterProfileResponse character;
    private int recentAttendanceCount;
    private List<EventProgressResponse> activeEvents;
}
