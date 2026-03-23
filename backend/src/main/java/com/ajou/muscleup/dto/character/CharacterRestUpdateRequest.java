package com.ajou.muscleup.dto.character;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CharacterRestUpdateRequest {
    @NotNull
    @JsonProperty("isResting")
    private Boolean isResting;
}
