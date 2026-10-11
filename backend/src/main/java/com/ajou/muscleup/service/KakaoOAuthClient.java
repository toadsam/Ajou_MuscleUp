package com.ajou.muscleup.service;

import com.ajou.muscleup.entity.SocialProvider;
import com.ajou.muscleup.service.SocialLoginService.SocialProfile;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.Arrays;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

/**
 * 카카오 로그인(REST, 인가 코드 방식). 화면이 카카오 로그인 창에서 받은 code 를 서버가 토큰으로 바꾸고 회원 정보를 읽는다.
 * 키는 환경변수로만: KAKAO_REST_API_KEY(필수) · KAKAO_CLIENT_SECRET(콘솔에서 켰을 때) · KAKAO_REDIRECT_URIS(허용할 돌아올 주소, 쉼표).
 * 키가 없으면 isConfigured()=false → 로그인 요청은 503("준비 중").
 *
 * 이메일은 "개인 개발자 비즈 앱" 전환 후 동의 항목을 켜야 온다. 안 와도 가입은 된다(SocialLoginService 의 내부용 주소).
 */
@Slf4j
@Component
public class KakaoOAuthClient {
    private static final String TOKEN_URL = "https://kauth.kakao.com/oauth/token";
    private static final String ME_URL = "https://kapi.kakao.com/v2/user/me";

    private final RestClient http = RestClient.create();
    private final String restApiKey;
    private final String clientSecret;
    private final List<String> allowedRedirectUris;

    public KakaoOAuthClient(
            @Value("${kakao.rest-api-key:}") String restApiKey,
            @Value("${kakao.client-secret:}") String clientSecret,
            @Value("${kakao.redirect-uris:}") String redirectUris
    ) {
        this.restApiKey = restApiKey == null ? "" : restApiKey.trim();
        this.clientSecret = clientSecret == null ? "" : clientSecret.trim();
        this.allowedRedirectUris = Arrays.stream((redirectUris == null ? "" : redirectUris).split(","))
                .map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    public boolean isConfigured() {
        return !restApiKey.isEmpty() && !allowedRedirectUris.isEmpty();
    }

    /** code → 카카오 회원 정보. 돌아올 주소는 허용 목록에 있어야 한다(카카오 콘솔에 등록한 주소와 같아야 함). */
    public SocialProfile fetchProfile(String code, String redirectUri) {
        if (!isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "카카오 로그인은 아직 준비 중이에요.");
        }
        if (redirectUri == null || !allowedRedirectUris.contains(redirectUri)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "허용되지 않은 로그인 주소예요.");
        }
        try {
            MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
            form.add("grant_type", "authorization_code");
            form.add("client_id", restApiKey);
            form.add("redirect_uri", redirectUri);
            form.add("code", code);
            if (!clientSecret.isEmpty()) form.add("client_secret", clientSecret);
            JsonNode token = http.post().uri(TOKEN_URL)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(JsonNode.class);
            String accessToken = token == null ? null : token.path("access_token").asText(null);
            if (accessToken == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "카카오 로그인에 실패했어요.");

            JsonNode me = http.get().uri(ME_URL)
                    .header("Authorization", "Bearer " + accessToken)
                    .retrieve()
                    .body(JsonNode.class);
            return toProfile(me);
        } catch (RestClientException e) {
            // 코드 만료 · 재사용 · 잘못된 키 등. 카카오 응답 본문(토큰 포함 가능)은 로그에 남기지 않는다.
            log.warn("카카오 로그인 실패: {}", e.getClass().getSimpleName());
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "카카오 로그인에 실패했어요. 다시 시도해 주세요.");
        }
    }

    /** 카카오 /v2/user/me 응답 → 공통 프로필. 이메일은 "유효 + 인증" 일 때만 인증된 이메일로 본다. */
    static SocialProfile toProfile(JsonNode me) {
        if (me == null || !me.hasNonNull("id")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "카카오 회원 정보를 읽지 못했어요.");
        }
        JsonNode account = me.path("kakao_account");
        String email = account.path("email").asText(null);
        boolean verified = email != null
                && account.path("is_email_valid").asBoolean(false)
                && account.path("is_email_verified").asBoolean(false);
        String nickname = account.path("profile").path("nickname").asText(null);
        if (nickname == null) nickname = me.path("properties").path("nickname").asText(null);
        return new SocialProfile(SocialProvider.KAKAO, me.get("id").asText(), email, verified, nickname);
    }
}
