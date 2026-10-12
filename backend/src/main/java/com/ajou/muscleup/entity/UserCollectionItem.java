package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

/** 도감에서 모은 것 하나(CollectionItem 코드). 같은 걸 두 번 갖지 않는다 — 두 번째부터는 조각. */
@Entity
@Table(name = "user_collection_items",
        uniqueConstraints = @UniqueConstraint(name = "uk_user_collection_item", columnNames = {"user_id", "item_code"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserCollectionItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "item_code", nullable = false, length = 40)
    private String itemCode;

    /** BOX · CRAFT · ACHIEVEMENT */
    @Column(nullable = false, length = 12)
    private String source;

    @Column(name = "acquired_at", nullable = false)
    private LocalDateTime acquiredAt;

    /** 도감 화면에서 "새로 얻음"을 봤는지 */
    @Column(nullable = false)
    private boolean seen;
}
