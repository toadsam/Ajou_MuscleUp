package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
// BragPostRepository.findAllByOrderByCreatedAtDesc(Pageable) — 자랑방 목록은
// 최신순 페이지네이션이다. 인덱스가 없으면 한 페이지(10건)를 주려고 테이블
// 전체를 읽어 정렬(filesort)하고, 글이 쌓일수록 뒤 페이지가 더 느려진다.
@Table(indexes = {@Index(name = "idx_brag_post_created", columnList = "created_at")})
public class BragPost extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private User user;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(nullable = false, length = 2000)
    private String content;

    @Column(length = 120)
    private String movement;

    @Column(length = 60)
    private String weight;

    @ElementCollection
    @CollectionTable(name = "brag_media", joinColumns = @JoinColumn(name = "brag_id"))
    @Column(name = "media_url", length = 500)
    private List<String> mediaUrls = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private BragVisibility visibility = BragVisibility.PUBLIC;

    // 어느 짐(모임) 자랑방에 올렸는지. null = 광장(전체)에만. visibility=GYM 이면 그 짐 멤버만 본다
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "gym_id")
    private WorkoutCrew gym;
}
