package com.ajou.muscleup.dto.brag;

import com.ajou.muscleup.dto.ai.AiChatLogItem;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;

@Getter
@AllArgsConstructor
public class MyPageResponse {
    private String email;
    private String nickname;

    private List<BragCommentResponse> recentComments;
    private List<BragPostResponse> recentLikes;
    private List<AiChatLogItem> recentAiChats;
}
