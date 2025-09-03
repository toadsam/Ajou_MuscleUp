// src/main/java/com/ajou/muscleup/entity/User.java
package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "users") // DB 테이블 이름
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false, length = 20)
    private String role = "USER";

    @Column(nullable = false, length = 30)
    private String nickname;   // ✅ 이 필드가 있어야 함
}
