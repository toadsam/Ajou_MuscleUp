package com.ajou.muscleup.dto;

import com.ajou.muscleup.entity.User;
import lombok.*;

@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class UserDTO {
    private Long id;
    private String name;
    private String email;
    private String nickname;
    private String role;

    public static UserDTO from(User u) {
        if (u == null) return null;
        return UserDTO.builder()
                .id(u.getId())
                .name(u.getName())
                .email(u.getEmail())
                .nickname(u.getNickname())
                .role(u.getRole())
                .build();
    }
}
