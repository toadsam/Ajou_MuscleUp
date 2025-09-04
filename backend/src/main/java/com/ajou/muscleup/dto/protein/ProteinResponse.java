// src/main/java/com/ajou/muscleup/dto/ProteinResponse.java
package com.ajou.muscleup.dto.protein;

import com.ajou.muscleup.entity.Protein;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class ProteinResponse {
    private Long id;
    private String name;
    private Integer price;
    private Integer days;
    private Integer goal;
    private String imageUrl;
    private String description;
    private String category;
    private Double avgRating;   // 평균 평점(없으면 null)

    /** 엔티티만으로 DTO 생성 */
    public static ProteinResponse from(Protein p) {
        return from(p, null);
    }

    /** 엔티티 + 평균평점(계산/덮어쓰기)으로 DTO 생성 */
    public static ProteinResponse from(Protein p, Double avgOverride) {
        if (p == null) return null;

        return ProteinResponse.builder()
                .id(p.getId())
                .name(p.getName())
                .price(p.getPrice())
                .days(p.getDays())
                .goal(p.getGoal())
                .imageUrl(p.getImageUrl())
                .description(p.getDescription())
                .category(p.getCategory())
                // avgOverride가 있으면 우선 적용, 없으면 엔티티 값 사용
                .avgRating(avgOverride != null ? avgOverride : p.getAvgRating())
                .build();
    }
}
