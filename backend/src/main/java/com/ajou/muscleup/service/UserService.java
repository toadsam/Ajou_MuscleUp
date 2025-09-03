// src/main/java/com/ajou/muscleup/service/UserService.java
package com.ajou.muscleup.service;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.dto.UserDTO;
import com.ajou.muscleup.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;

    public UserDTO registerUser(String name, String email, String password) {
        User user = User.builder()
                .name(name)
                .email(email)
                .password(password) // ✅ 나중에 BCrypt 암호화
                .role("USER")
                .build();
        userRepository.save(user);

        return UserDTO.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .build();
    }
}
