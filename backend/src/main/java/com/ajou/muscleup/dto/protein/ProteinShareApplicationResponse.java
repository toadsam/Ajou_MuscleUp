package com.ajou.muscleup.dto.protein;

import com.ajou.muscleup.entity.ProteinShareApplication;
import com.ajou.muscleup.entity.ProteinShareStatus;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProteinShareApplicationResponse {
    private Long id;
    private Long proteinId;
    private Long userId;
    private String userNickname;
    private ProteinShareStatus status;
    private LocalDateTime createdAt;

    public static ProteinShareApplicationResponse from(ProteinShareApplication application) {
        return ProteinShareApplicationResponse.builder()
                .id(application.getId())
                .proteinId(application.getProtein().getId())
                .userId(application.getUser().getId())
                .userNickname(application.getUser().getNickname())
                .status(application.getStatus())
                .createdAt(application.getCreatedAt())
                .build();
    }
}
