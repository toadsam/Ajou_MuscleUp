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

        // 3) 닉네임 기본값 처리 (없으면 name)
        String nickname = (req.getNickname() == null || req.getNickname().isBlank())
                ? req.getName().trim()
                : req.getNickname().trim();

        // 4) 저장
        User user = User.builder()
                .name(req.getName().trim())
                .email(email)
                .password(passwordEncoder.encode(req.getPassword()))
                .role("USER")
                .nickname(nickname)
                .build();

        return UserDTO.from(userRepository.save(user));
    }
}
