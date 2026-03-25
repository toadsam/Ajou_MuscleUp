package com.ajou.muscleup.dto.character;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CharacterChangeResponse {
    private boolean leveledUp;
    private boolean evolved;
    private boolean tierChanged;
    private CharacterSnapshotResponse before;
    private CharacterSnapshotResponse after;
}
