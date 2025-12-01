package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.brag.BragCommentCreateRequest;
import com.ajou.muscleup.dto.brag.BragCommentResponse;
import com.ajou.muscleup.dto.brag.BragLikeResponse;
import com.ajou.muscleup.service.BragInteractionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/brags")
@RequiredArgsConstructor
public class BragInteractionController {
    private final BragInteractionService interactionService;

    @GetMapping("/{id}/comments")
    public ResponseEntity<List<BragCommentResponse>> listComments(@PathVariable("id") Long postId) {
        return ResponseEntity.ok(interactionService.listComments(postId));
    }

    @PostMapping("/{id}/comments")
    public ResponseEntity<BragCommentResponse> addComment(@AuthenticationPrincipal String email,
                                                          @PathVariable("id") Long postId,
                                                          @Valid @RequestBody BragCommentCreateRequest req) {
        return ResponseEntity.ok(interactionService.addComment(email, postId, req));
    }

    @DeleteMapping("/comments/{commentId}")
    public ResponseEntity<Void> deleteComment(@AuthenticationPrincipal String email,
                                              @PathVariable("commentId") Long commentId) {
        interactionService.deleteComment(email, commentId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/like")
    public ResponseEntity<BragLikeResponse> toggleLike(@AuthenticationPrincipal String email,
                                                       @PathVariable("id") Long postId) {
        return ResponseEntity.ok(interactionService.toggleLike(email, postId));
    }

    @GetMapping("/{id}/like")
    public ResponseEntity<BragLikeResponse> likeStatus(@AuthenticationPrincipal String email,
                                                       @PathVariable("id") Long postId) {
        return ResponseEntity.ok(interactionService.likeStatus(email, postId));
    }
}
