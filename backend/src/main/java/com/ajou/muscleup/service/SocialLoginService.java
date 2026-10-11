package com.ajou.muscleup.service;

import com.ajou.muscleup.entity.SocialAccount;
import com.ajou.muscleup.entity.SocialProvider;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.SocialAccountRepository;
import com.ajou.muscleup.repository.UserRepository;
import java.security.SecureRandom;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 소셜 로그인(Google · 카카오) 결과 → 우리 사용자. 설계: docs/design/stage0-gyms.md §3.
 *
 * 1) (공급자, 회원 고유 번호) 로 연결된 사용자가 있으면 그 사람.
 * 2) 없고, 공급자가 "인증했다"고 한 이메일이 있으면 그 이메일의 기존 사용자에 연결(예전 Google 가입자가 여기로 자동 이전된다).
 *    인증되지 않은 이메일로는 기존 계정에 붙이지 않는다(남의 계정 가로채기 방지).
 * 3) 둘 다 아니면 새로 가입. 이메일이 없거나 쓸 수 없으면 내부용 주소(…@users.musclehub.invalid, emailPlaceholder=true).
 *
 * 로그인 주체(JWT subject)가 아직 이메일이라 이메일 칸은 항상 채운다. 주체를 사용자 id 로 바꾸는 일은 나중(설계 §3).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SocialLoginService {
    static final String PLACEHOLDER_DOMAIN = "users.musclehub.invalid";
    private static final int NICKNAME_MAX = 30;
    private static final int NAME_MAX = 50;

    private final SocialAccountRepository socialAccountRepository;
    private final UserRepository userRepository;
    private final UserService userService;

    public record SocialProfile(
            SocialProvider provider,
            String providerUserId,
            String email,
            boolean emailVerified,
            String displayName
    ) {}

    @Transactional
    public User resolveUser(SocialProfile p) {
        if (p.providerUserId() == null || p.providerUserId().isBlank()) {
            throw new IllegalArgumentException("providerUserId is required");
        }
        Optional<SocialAccount> linked = socialAccountRepository.findByProviderAndProviderUserId(p.provider(), p.providerUserId());
        if (linked.isPresent()) return linked.get().getUser();

        String email = normalizeEmail(p.email());
        if (email != null && p.emailVerified()) {
            Optional<User> existing = userRepository.findByEmail(email);
            if (existing.isPresent()) {
                link(existing.get(), p, email);
                return existing.get();
            }
        }

        // 새로 가입. 인증된 이메일이 비어 있지 않고 아직 아무도 안 쓰면 그 이메일, 아니면 내부용 주소
        boolean useRealEmail = email != null && p.emailVerified() && !userRepository.existsByEmail(email);
        String accountEmail = useRealEmail ? email : placeholderEmail(p);
        String nickname = nicknameFrom(p.displayName(), email);
        User user = new User();
        user.setEmail(accountEmail);
        user.setEmailPlaceholder(useRealEmail ? null : Boolean.TRUE);
        user.setName(truncate(p.displayName() != null && !p.displayName().isBlank() ? p.displayName().trim() : nickname, NAME_MAX));
        user.setNickname(nickname);
        user.setRole("ROLE_USER");
        user.setPassword(userService.encodePassword(p.provider().name().toLowerCase(Locale.ROOT) + "-" + UUID.randomUUID()));
        User saved = userRepository.save(user);
        link(saved, p, email);
        log.info("소셜 가입: provider={} userId={} placeholderEmail={}", p.provider(), saved.getId(), !useRealEmail);
        return saved;
    }

    private void link(User user, SocialProfile p, String email) {
        socialAccountRepository.save(SocialAccount.builder()
                .user(user)
                .provider(p.provider())
                .providerUserId(p.providerUserId())
                .emailAtLink(email)
                .build());
    }

    static String placeholderEmail(SocialProfile p) {
        String id = p.providerUserId().replaceAll("[^A-Za-z0-9._-]", "");
        return p.provider().name().toLowerCase(Locale.ROOT) + "-" + id + "@" + PLACEHOLDER_DOMAIN;
    }

    private static String normalizeEmail(String email) {
        if (email == null || email.isBlank()) return null;
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static String nicknameFrom(String displayName, String email) {
        if (displayName != null && !displayName.isBlank()) return truncate(displayName.trim(), NICKNAME_MAX);
        if (email != null) return truncate(email.split("@")[0], NICKNAME_MAX);
        return "리프터" + (1000 + new SecureRandom().nextInt(9000));
    }

    private static String truncate(String v, int max) {
        return v.length() <= max ? v : v.substring(0, max);
    }
}
