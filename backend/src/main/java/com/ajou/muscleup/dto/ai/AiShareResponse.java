package com.ajou.muscleup.dto.ai;

import com.ajou.muscleup.entity.AiMessageType;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class AiShareResponse {
    private Long id;
    private AiMessageType type;
    private String question;
    private String answer;
    private LocalDateTime createdAt;
    private String shareSlug;
}
