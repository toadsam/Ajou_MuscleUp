package com.ajou.muscleup.dto.character;

import com.ajou.muscleup.entity.CharacterTier;
import com.ajou.muscleup.entity.Gender;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CharacterRankingResponse {
    private String nickname;
    private int level;
    private CharacterTier tier;
    private int evolutionStage;
    private String title;
    private String avatarSeed;
    private Gender gender;
    @JsonProperty("isResting")
    private boolean isResting;
    private Double threeLiftTotal;
    // 순위의 근거(체성분·3대 중량)가 본인 입력값이면 true. 지금은 인증 절차가 없어 항상 true.
    private boolean selfReported;
    private LocalDateTime updatedAt;
}
