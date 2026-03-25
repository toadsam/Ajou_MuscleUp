package com.ajou.muscleup.dto.attendance;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class AttendanceRankingItemResponse {
    private Long userId;
    private String nickname;
    private int score;
}
