package com.ajou.muscleup.controller;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.service.GymDecorService;
import com.ajou.muscleup.service.GymVisitService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * 홈 헬스장 꾸미기(본인만).
 *   GET /api/gym-decor               자리마다 놓인 물품 + 물품 목록(얻었는지 · 진행도 · 조건)
 *   PUT /api/gym-decor/slots/{slot}  {code|null} 그 자리에 놓기 · 비우기
 * 친구 헬스장 구경 · 방명록(GymVisitService):
 *   GET    /api/gym-decor/friends/{userId}            친구 헬스장(모습 · 캐릭터 · 방명록). 친구가 아니면 404
 *   POST   /api/gym-decor/friends/{userId}/guestbook  {message} 한 줄 남기기
 *   GET    /api/gym-decor/guestbook                   내 헬스장 방명록
 *   DELETE /api/gym-decor/guestbook/{id}              지우기(주인 · 쓴 사람)
 */
@RestController
@RequestMapping("/api/gym-decor")
@RequiredArgsConstructor
public class GymDecorController {
    private final GymDecorService gymDecorService;
    private final GymVisitService gymVisitService;
    private final UserRepository userRepository;

    public record PlaceRequest(String code) {}

    public record GuestbookRequest(String message) {}

    @GetMapping
    public GymDecorService.View view(@AuthenticationPrincipal String email) {
        return gymDecorService.view(me(email));
    }

    @PutMapping("/slots/{slot}")
    public GymDecorService.View place(@AuthenticationPrincipal String email, @PathVariable String slot,
                                      @RequestBody(required = false) PlaceRequest req) {
        return gymDecorService.place(me(email), slot, req == null ? null : req.code());
    }

    @GetMapping("/friends/{userId}")
    public GymVisitService.FriendGym friendGym(@AuthenticationPrincipal String email, @PathVariable Long userId) {
        return gymVisitService.friendGym(me(email), userId);
    }

    @PostMapping("/friends/{userId}/guestbook")
    public GymVisitService.EntryView write(@AuthenticationPrincipal String email, @PathVariable Long userId,
                                           @RequestBody(required = false) GuestbookRequest req) {
        return gymVisitService.write(me(email), userId, req == null ? null : req.message());
    }

    @GetMapping("/guestbook")
    public List<GymVisitService.EntryView> myGuestbook(@AuthenticationPrincipal String email) {
        return gymVisitService.myGuestbook(me(email));
    }

    @DeleteMapping("/guestbook/{id}")
    public ResponseEntity<Void> deleteEntry(@AuthenticationPrincipal String email, @PathVariable Long id) {
        gymVisitService.delete(me(email), id);
        return ResponseEntity.noContent().build();
    }

    private User me(String email) {
        if (email == null || email.isBlank() || "anonymousUser".equals(email)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        }
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요."));
    }
}
