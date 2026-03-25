package com.ajou.muscleup.dto.crew;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CrewUpdateRequest {
    @NotBlank
    @Size(max = 60)
    private String name;

    @Size(max = 300)
    private String description;
}
