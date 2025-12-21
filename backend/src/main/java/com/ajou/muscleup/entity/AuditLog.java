package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "audit_logs", indexes = {
        @Index(name = "idx_audit_created", columnList = "createdAt"),
        @Index(name = "idx_audit_user", columnList = "user_id")
})
public class AuditLog extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    private User user;

    @Column(nullable = false, length = 50)
    private String action; // e.g., POST/PUT/DELETE

    @Column(nullable = false, length = 255)
    private String resource; // e.g., path or entity name

    @Column(length = 1000)
    private String summary;

    @Column(columnDefinition = "TEXT")
    private String metadata;
}
