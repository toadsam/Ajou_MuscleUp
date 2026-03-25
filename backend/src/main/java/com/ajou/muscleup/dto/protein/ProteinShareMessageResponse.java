package com.ajou.muscleup.dto.protein;

import com.ajou.muscleup.entity.ProteinShareMessage;
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
public class ProteinShareMessageResponse {
    private Long id;
    private Long userId;
    private String userNickname;
    private String content;
    private LocalDateTime createdAt;

    public static ProteinShareMessageResponse from(ProteinShareMessage message) {
        return ProteinShareMessageResponse.builder()
                .id(message.getId())
                .userId(message.getUser().getId())
                .userNickname(message.getUser().getNickname())
                .content(message.getContent())
                .createdAt(message.getCreatedAt())
                .build();
    }
}
