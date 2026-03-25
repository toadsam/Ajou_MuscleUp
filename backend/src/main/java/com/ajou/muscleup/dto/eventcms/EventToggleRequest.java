package com.ajou.muscleup.dto.eventcms;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class EventToggleRequest {
    @NotNull
    private Boolean value;
}
