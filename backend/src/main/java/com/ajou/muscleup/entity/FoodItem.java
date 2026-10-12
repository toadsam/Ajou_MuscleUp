package com.ajou.muscleup.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * <b>쓰지 않는 빈 표.</b> 음식 검색 데이터는 이제 서버 메모리에 있다(FoodCatalogService).
 *
 * 처음에는 이 표에 32만 줄을 넣었는데 운영 DB 볼륨이 가득 차 DB 가 멈췄다(docs/fixes/2026-10-12-food-search-incident.md).
 * 엔티티를 남겨 두는 이유: 이미 배포한 이전 SQL V5(이 표에 trigram 인덱스)는 고칠 수 없고, 새로 만드는 DB 에서는
 * V5 가 이 표를 찾는다. V6 이 표를 비우고 인덱스를 지운다. 여기에 데이터를 넣지 않는다.
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
