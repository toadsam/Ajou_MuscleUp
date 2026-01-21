package com.ajou.muscleup.dto.character;

import java.util.List;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CharacterRankingListResponse {
    private List<CharacterRankingResponse> items;
    private long totalPublic;
    private Integer myRank;
    private Double myTopPercent;
}
