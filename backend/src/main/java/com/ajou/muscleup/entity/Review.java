package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Max; import jakarta.validation.constraints.Min;
import lombok.*;

@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
@Entity
public class Review extends BaseTimeEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private Protein protein;

    @Min(1) @Max(5)
    private int rating;

    @Column(length = 1000)
    private String content;
}
