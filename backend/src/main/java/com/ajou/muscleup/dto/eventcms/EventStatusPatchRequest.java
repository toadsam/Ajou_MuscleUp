package com.ajou.muscleup.dto.eventcms;

import com.ajou.muscleup.entity.CmsEventStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class EventStatusPatchRequest {
    @NotNull
    private CmsEventStatus status;
}
