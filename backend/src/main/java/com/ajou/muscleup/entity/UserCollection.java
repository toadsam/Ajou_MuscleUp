package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import lombok.*;

/**
 * 도감 지갑: 열지 않은 보상 상자 · 조각 · 장착한 것. 사람마다 한 줄(처음 쓸 때 만든다).
 * 상자 · 조각은 같은 줄을 잠그고(findForUpdate) 바꾼다 — 두 번 눌러도 상자가 두 번 열리지 않게.
 */
@Entity
@Table(name = "user_collections", uniqueConstraints = @UniqueConstraint(name = "uk_user_collection_user", columnNames = "user_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserCollection extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private int boxes;

    @Column(nullable = false)
    private int shards;

    @Column(name = "boxes_opened", nullable = false)
    private int boxesOpened;

    @Column(name = "equipped_title", length = 40)
    private String equippedTitle;

    @Column(name = "equipped_tank", length = 40)
    private String equippedTank;

    @Column(name = "equipped_frame", length = 40)
    private String equippedFrame;

    /** 처음 도감에 왔을 때 주는 상자 하나 */
    @Column(name = "welcome_given", nullable = false)
    private boolean welcomeGiven;

    /** 출석 "행운 상자"를 굴린 마지막 날(하루 한 번) */
    @Column(name = "last_lucky_date")
    private LocalDate lastLuckyDate;
}
