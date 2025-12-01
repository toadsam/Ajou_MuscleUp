package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "inquiries")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class Inquiry extends BaseTimeEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 100)
    private String name;

    @Column(length = 150)
    private String email;

    @Column(length = 1000, nullable = false)
    private String message;

    @Column(length = 200)
    private String page; // where the user opened the widget

    private Long userId; // optional, if logged in
}

