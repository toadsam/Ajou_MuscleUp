package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.UserDTO;
import com.ajou.muscleup.dto.UserRegisterRequest;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailVerificationService emailVerificationService;

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
        User user = userRepository.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "이메일이 존재하지 않습니다."));

        if (!passwordEncoder.matches(rawPassword, user.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "비밀번호가 일치하지 않습니다.");
        }

        return user;
    }
}
