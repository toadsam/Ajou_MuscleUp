package com.ajou.muscleup.dto.club;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ClubRosterUpdateRequest(@NotNull @Size(max = 1000) List<String> names) {}
