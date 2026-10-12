package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * 음식 검색용 영양 정보(공공 데이터). 사용자 데이터가 아니다.
 * 출처: 식품의약품안전처 식품영양성분 데이터베이스(가공식품 · 음식), 농촌진흥청 국가표준식품성분 DB(원재료).
 * resources/food/foods.tsv.gz 를 FoodCatalogService 가 통째로 넣는다(다시 넣으면 id 가 바뀌므로 다른 테이블이 가리키지 않는다).
 */
@Entity
@Table(name = "food_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FoodItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FoodSource source;

    @Column(nullable = false, length = 200)
    private String name;

    /** 제조 · 유통 업체(가공식품), 음식점(음식). 원재료는 빈칸 */
    @Column(length = 100)
    private String maker;

    /** 검색용: 이름 + " " + 업체를 소문자로, 글자 · 숫자만 남김(FoodCatalogService.normalize) */
    @Column(name = "search_key", nullable = false, length = 320)
    private String searchKey;

    /** 영양 기준량: "100g" 또는 "100ml" */
    @Column(nullable = false, length = 10)
    private String basis;

    private Double kcal;

    @Column(name = "protein_g")
    private Double proteinG;

    @Column(name = "fat_g")
    private Double fatG;

    @Column(name = "carb_g")
    private Double carbG;

    /** 1회 섭취참고량(가공식품) · 1인분(음식), g 또는 ml. 모르면 빈칸 */
    @Column(name = "serving_g")
    private Double servingG;

    /** 포장 전체 무게(가공식품), g 또는 ml. 모르면 빈칸 */
    @Column(name = "package_g")
    private Double packageG;
}
