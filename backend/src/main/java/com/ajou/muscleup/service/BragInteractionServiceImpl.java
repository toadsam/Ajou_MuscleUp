package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.brag.BragCommentCreateRequest;
import com.ajou.muscleup.dto.brag.BragCommentResponse;
import com.ajou.muscleup.dto.brag.BragCommentUpdateRequest;
import com.ajou.muscleup.dto.brag.BragLikeResponse;
import com.ajou.muscleup.entity.BragComment;
import com.ajou.muscleup.entity.BragLike;
import com.ajou.muscleup.entity.BragPost;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.BragCommentRepository;
import com.ajou.muscleup.repository.BragLikeRepository;
import com.ajou.muscleup.repository.BragPostRepository;
import com.ajou.muscleup.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class BragInteractionServiceImpl implements BragInteractionService {
    private final BragCommentRepository commentRepository;
    private final BragLikeRepository likeRepository;
    private final BragPostRepository postRepository;
    private final UserRepository userRepository;

    private User requireUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
    }

    private BragPost requirePost(Long postId) {
        return postRepository.findById(postId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."));
    }

    @Override
    @Transactional(readOnly = true)
    public List<BragCommentResponse> listComments(Long postId) {
        return commentRepository.findByBragPost_IdOrderByCreatedAtAsc(postId)
                .stream().map(BragCommentResponse::from).toList();
    }

    @Override
    public BragCommentResponse addComment(String userEmail, Long postId, BragCommentCreateRequest req) {
        User user = requireUser(userEmail);
        BragPost post = requirePost(postId);
        BragComment saved = commentRepository.save(BragComment.builder()
                .bragPost(post)
                .user(user)
                .content(req.getContent().trim())
                .build());
        return BragCommentResponse.from(saved);
    }

    @Override
    public BragCommentResponse updateComment(String userEmail, Long commentId, BragCommentUpdateRequest req) {
        User user = requireUser(userEmail);
        BragComment c = commentRepository.findById(commentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "댓글을 찾을 수 없습니다."));
        if (!c.getUser().getId().equals(user.getId()) && !isAdmin(user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "본인 댓글만 수정할 수 있습니다.");
        }
        c.setContent(req.getContent().trim());
        BragComment saved = commentRepository.save(c);
        return BragCommentResponse.from(saved);
    }

    @Override
    public void deleteComment(String userEmail, Long commentId) {
        User user = requireUser(userEmail);
        BragComment c = commentRepository.findById(commentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "댓글을 찾을 수 없습니다."));
        if (!c.getUser().getId().equals(user.getId()) && !isAdmin(user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "본인 댓글만 삭제할 수 있습니다.");
        }
        commentRepository.delete(c);
    }

    @Override
    public BragLikeResponse toggleLike(String userEmail, Long postId) {
        User user = requireUser(userEmail);
        BragPost post = requirePost(postId);
        boolean exists = likeRepository.existsByBragPost_IdAndUser_Id(postId, user.getId());
        if (exists) {
            likeRepository.deleteByBragPost_IdAndUser_Id(postId, user.getId());
        } else {
            likeRepository.save(BragLike.builder().bragPost(post).user(user).build());
        }
        long count = likeRepository.countByPostId(postId);
        return new BragLikeResponse(count, !exists);
    }

    @Override
    @Transactional(readOnly = true)
    public BragLikeResponse likeStatus(String userEmail, Long postId) {
        long count = likeRepository.countByPostId(postId);
        if (userEmail == null || userEmail.isBlank()) {
            return new BragLikeResponse(count, false);
        }
        User user = requireUser(userEmail);
        boolean liked = likeRepository.existsByBragPost_IdAndUser_Id(postId, user.getId());
        return new BragLikeResponse(count, liked);
    }

    private boolean isAdmin(User user) {
        return user != null && "ADMIN".equalsIgnoreCase(user.getRole());
    }
}
