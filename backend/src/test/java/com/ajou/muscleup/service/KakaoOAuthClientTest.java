package com.ajou.muscleup.service;

import com.ajou.muscleup.entity.SocialProvider;
import com.ajou.muscleup.service.SocialLoginService.SocialProfile;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;

/** 카카오 회원 정보 응답 해석 · 설정 없을 때 · 허용 안 된 돌아올 주소. 네트워크는 쓰지 않는다. */
class KakaoOAuthClientTest {
    private final ObjectMapper om = new ObjectMapper();

    @Test
    void parsesVerifiedEmailAndNickname() throws Exception {
        SocialProfile p = KakaoOAuthClient.toProfile(om.readTree("""
                {"id":12345,"kakao_account":{"email":"a@b.com","is_email_valid":true,"is_email_verified":true,
                 "profile":{"nickname":"근육맨"}}}"""));
        assertEquals(SocialProvider.KAKAO, p.provider());
        assertEquals("12345", p.providerUserId());
        assertEquals("a@b.com", p.email());
        assertTrue(p.emailVerified());
        assertEquals("근육맨", p.displayName());
    }

    @Test
    void unverifiedOrMissingEmailIsNotTrusted() throws Exception {
        assertFalse(KakaoOAuthClient.toProfile(om.readTree("""
                {"id":1,"kakao_account":{"email":"a@b.com","is_email_valid":true,"is_email_verified":false}}""")).emailVerified());
        SocialProfile none = KakaoOAuthClient.toProfile(om.readTree("{\"id\":2,\"properties\":{\"nickname\":\"닉\"}}"));
        assertNull(none.email());
        assertEquals("닉", none.displayName());
    }

    @Test
    void notConfiguredOrWrongRedirectIsRejected() {
        assertFalse(new KakaoOAuthClient("", "", "").isConfigured());
        ResponseStatusException off = assertThrows(ResponseStatusException.class,
                () -> new KakaoOAuthClient("", "", "").fetchProfile("c", "https://x"));
        assertEquals(503, off.getStatusCode().value());
        ResponseStatusException bad = assertThrows(ResponseStatusException.class,
                () -> new KakaoOAuthClient("key", "", "https://musclehub.co.kr/auth/kakao/callback").fetchProfile("c", "https://evil.example/cb"));
        assertEquals(400, bad.getStatusCode().value());
    }
}
