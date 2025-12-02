package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.brag.BragCommentCreateRequest;
import com.ajou.muscleup.dto.brag.BragCommentResponse;
import com.ajou.muscleup.dto.brag.BragLikeResponse;
import com.ajou.muscleup.dto.brag.BragCommentUpdateRequest;

import java.util.List;

public interface BragInteractionService {
    List<BragCommentResponse> listComments(Long postId);
    BragCommentResponse addComment(String userEmail, Long postId, BragCommentCreateRequest req);
    BragCommentResponse updateComment(String userEmail, Long commentId, BragCommentUpdateRequest req);
    void deleteComment(String userEmail, Long commentId);

    BragLikeResponse toggleLike(String userEmail, Long postId);
    BragLikeResponse likeStatus(String userEmail, Long postId);
}
