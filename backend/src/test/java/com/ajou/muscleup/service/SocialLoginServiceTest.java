package com.ajou.muscleup.service;

import com.ajou.muscleup.entity.SocialProvider;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.SocialAccountRepository;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.service.SocialLoginService.SocialProfile;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;

/** 소셜 로그인 → 사용자 찾기 · 연결 · 가입 규칙(docs/design/stage0-gyms.md §3). 테스트가 끝나면 되돌린다. */
@SpringBootTest
@Transactional
class SocialLoginServiceTest {

    @Autowired SocialLoginService service;
    @Autowired UserRepository users;
    @Autowired SocialAccountRepository accounts;

    private User existing(String email) {
        return users.save(User.builder().name("기존").email(email).password("x").role("ROLE_USER").nickname("기존회원").build());
    }

    @Test
    void googleLinksExistingUserByVerifiedEmailThenFindsBySub() {
        User old = existing("sl-google@test.local");
        User first = service.resolveUser(new SocialProfile(SocialProvider.GOOGLE, "g-sub-1", "SL-Google@test.local", true, "구글이름"));
        assertEquals(old.getId(), first.getId(), "예전 Google 가입자는 이메일로 찾아 연결");
        assertTrue(accounts.findByProviderAndProviderUserId(SocialProvider.GOOGLE, "g-sub-1").isPresent());
        // 다음엔 이메일이 바뀌어도 sub 로 같은 사람
        User again = service.resolveUser(new SocialProfile(SocialProvider.GOOGLE, "g-sub-1", "changed@test.local", true, "구글이름"));
        assertEquals(old.getId(), again.getId());
    }

    @Test
    void kakaoWithoutEmailGetsPlaceholderAccount() {
        User u = service.resolveUser(new SocialProfile(SocialProvider.KAKAO, "998877", null, false, "카카오닉"));
        assertEquals("kakao-998877@users.musclehub.invalid", u.getEmail());
        assertFalse(u.hasRealEmail());
        assertEquals("카카오닉", u.getNickname());
        assertEquals("ROLE_USER", u.getRole());
        assertEquals(u.getId(), service.resolveUser(new SocialProfile(SocialProvider.KAKAO, "998877", null, false, "다른닉")).getId());
    }

    @Test
    void unverifiedEmailNeverTakesOverExistingAccount() {
        User victim = existing("sl-victim@test.local");
        User u = service.resolveUser(new SocialProfile(SocialProvider.KAKAO, "555", "sl-victim@test.local", false, "가로채기"));
        assertNotEquals(victim.getId(), u.getId(), "인증 안 된 이메일로 남의 계정에 붙지 않는다");
        assertFalse(u.hasRealEmail());
    }

    @Test
    void kakaoVerifiedEmailLinksExistingAccount() {
        User old = existing("sl-kakao@test.local");
        User u = service.resolveUser(new SocialProfile(SocialProvider.KAKAO, "777", "sl-kakao@test.local", true, "카카오"));
        assertEquals(old.getId(), u.getId());
    }

    @Test
    void newUserWithVerifiedEmailUsesRealEmail() {
        User u = service.resolveUser(new SocialProfile(SocialProvider.GOOGLE, "g-new", "sl-new@test.local", true, null));
        assertEquals("sl-new@test.local", u.getEmail());
        assertTrue(u.hasRealEmail());
        assertEquals("sl-new", u.getNickname());
    }
}
