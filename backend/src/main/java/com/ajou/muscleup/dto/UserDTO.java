// src/main/java/com/ajou/muscleup/dto/UserDTO.java
package com.ajou.muscleup.dto;

import lombok.*;

@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class UserDTO {
    private Long id;
    private String name;
    private String email;
}
