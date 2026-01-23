package com.ajou.muscleup.dto.protein;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ProteinShareSummaryResponse {
    private long pendingCount;
    private long approvedCount;
}
