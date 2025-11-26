package com.ajou.muscleup.dto.brag;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class BragLikeResponse {
    private long likeCount;
    private boolean liked;
}
