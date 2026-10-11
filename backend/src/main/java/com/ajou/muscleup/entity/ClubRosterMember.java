package com.ajou.muscleup.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 동아리 회원 명단(실명) 한 줄. 예전에는 프론트 코드(Members.tsx)에 박혀 있어 누구나 JS 파일로 받을 수 있었다.
 * 이제 서버에만 두고 로그인한 회원에게만 내려 준다. 관리자가 통째로 바꾼다(ClubRosterService.replace).
 * 0단계 "짐" 구조가 들어오면 짐별 명단으로 옮긴다(docs/design/stage0-gyms.md).
 */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "club_roster_members")
public class ClubRosterMember extends BaseTimeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 30)
    private String name;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;
}
