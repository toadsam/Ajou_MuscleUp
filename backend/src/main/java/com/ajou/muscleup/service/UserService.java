package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.UserDTO;
import com.ajou.muscleup.dto.UserRegisterRequest;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.security.RateLimiter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailVerificationService emailVerificationService;
    private final RateLimiter rateLimiter;

    private static final int LOGIN_FAIL_LIMIT = 5;
    private static final Duration LOGIN_FAIL_WINDOW = Duration.ofMinutes(15);
    /** 없는 계정일 때 비교용으로 쓰는 BCrypt 해시(임의 문자열을 해시한 값, 비밀 아님). */
    private static final String DUMMY_HASH = "$2a$10$7EqJtq98hPqEX7fNZaFWoOhi5BWX4Z0Fh6v4Zp1VmrKx0QFQyAEZ6";

    // ✅ 회원가입
    public UserDTO register(UserRegisterRequest req) {
        final String email = req.getEmail().trim().toLowerCase();

        // 1) 이메일 인증 여부 확인
        if (!emailVerificationService.isVerified(email)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이메일 인증이 필요합니다.");
        }

        // 2) 중복 이메일 체크
        if (userRepository.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 가입된 이메일입니다.");
        }

        // 3) 닉네임 기본값 처리
        String nickname = (req.getNickname() == null || req.getNickname().isBlank())
                ? req.getName().trim()
                : req.getNickname().trim();

        // 4) 저장 (비밀번호는 BCrypt로 암호화)
        User user = User.builder()
                .name(req.getName().trim())
                .email(email)
                .password(passwordEncoder.encode(req.getPassword()))
                .role("ROLE_USER")
                .nickname(nickname)
                .build();

        return UserDTO.from(userRepository.save(user));
    }

    // ✅ 로그인
    public User login(String email, String rawPassword) {
        return login(email, rawPassword, null);
    }

    /**
     * 로그인. 이메일이 없을 때와 비밀번호가 틀릴 때 같은 문장을 돌려줘 가입 여부를 알 수 없게 한다.
     * 같은 (이메일 + IP) 로 LOGIN_FAIL_LIMIT 번 틀리면 LOGIN_FAIL_WINDOW 동안 429 로 막는다.
     */
    public User login(String email, String rawPassword, String clientIp) {
        final String normalized = email == null ? "" : email.trim().toLowerCase();
        final String throttleKey = "login-fail:" + normalized + "|" + (clientIp == null ? "-" : clientIp);

        if (rateLimiter.isBlocked(throttleKey, LOGIN_FAIL_LIMIT)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "로그인 시도가 너무 많아요. 15분 뒤에 다시 시도해 주세요.");
        }

        User user = userRepository.findByEmail(normalized).orElse(null);
        // 없는 이메일이어도 같은 시간만큼 해시 비교를 해서 응답 시간으로 가입 여부를 알 수 없게 한다.
        String hashToCheck = user != null ? user.getPassword() : DUMMY_HASH;
        boolean matches = rawPassword != null && hashToCheck != null && passwordEncoder.matches(rawPassword, hashToCheck);

        if (user == null || !matches) {
            rateLimiter.recordFailure(throttleKey, LOGIN_FAIL_WINDOW);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "이메일 또는 비밀번호가 올바르지 않습니다.");
        }

        rateLimiter.reset(throttleKey);
        return user;
    }

    public String encodePassword(String raw) {
        return passwordEncoder.encode(raw);
    }
}
