package com.ajou.muscleup.dto.character;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;

@Getter
public class CharacterPublicUpdateRequest {
    @NotNull
    @JsonProperty("isPublic")
    private Boolean isPublic;
}
