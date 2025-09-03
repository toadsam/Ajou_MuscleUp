package com.ajou.muscleup.dto.protein;

import com.ajou.muscleup.entity.Protein;
import lombok.*;

@Getter @Builder
public class ProteinResponse {
    private Long id;
    private String name;
    private Integer price;
    private Integer days;
    private Integer goal;
    private String imageUrl;
    private String description;
    private String category;
    private Double avgRating;

    public static ProteinResponse from(Protein p) {
        return ProteinResponse.builder()
                .id(p.getId())
                .name(p.getName())
                .price(p.getPrice())
                .days(p.getDays())
                .goal(p.getGoal())
                .imageUrl(p.getImageUrl())
                .description(p.getDescription())
                .category(p.getCategory())
                .avgRating(p.getAvgRating())
                .build();
    }
}
