package com.ajou.muscleup.dto.character;

import com.ajou.muscleup.entity.CharacterTier;
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
    private Double threeLiftTotal;
    private LocalDateTime updatedAt;
}
