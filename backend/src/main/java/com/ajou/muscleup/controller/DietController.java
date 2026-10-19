package com.ajou.muscleup.controller;

import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.UserRepository;
import com.ajou.muscleup.service.BarcodeService;
import com.ajou.muscleup.service.DietService;
import com.ajou.muscleup.service.FoodCatalogService;
import com.ajou.muscleup.service.FoodPhotoService;
import com.ajou.muscleup.service.MyFoodService;
import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * 식단 기록(본인만).
 *   GET    /api/diet/day?date=           하루 기록 · 합계 · 목표
 *   GET    /api/diet/summary?from=&to=   날짜별 합계(최대 31일, 기본 최근 7일)
 *   GET    /api/diet/recent-foods        최근 적은 음식(다시 넣기)
 *   GET    /api/diet/foods?q=            음식 검색(공공 영양 DB, 100g · 100ml 기준 값, 최대 30개)
 *   GET    /api/diet/barcode/{code}      포장 바코드 → 제품 이름 + 영양값 후보(식약처 바코드 정보 → 음식 검색, 저장 안 함, 하루 100번)
 *   GET    /api/diet/my-foods            내 음식(검색에 없는 음식을 저장해 둔 것)
 *   POST   /api/diet/my-foods            내 음식 저장(같은 이름이면 새 값으로) { name, amount, kcal, proteinG, carbG, fatG }
 *   PUT    /api/diet/my-foods/{id}       고치기
 *   DELETE /api/diet/my-foods/{id}       지우기
 *   POST   /api/diet/photo (image)       음식 사진 → 후보(저장 안 함, 하루 10번) — 확인 뒤 entries 에 source=PHOTO 로 저장
 *   POST   /api/diet/entries             기록 추가 { date, mealType, name, amount, kcal, proteinG, carbG, fatG }
 *   PUT    /api/diet/entries/{id}        고치기
 *   DELETE /api/diet/entries/{id}        지우기
 *   GET    /api/diet/goal                목표(없으면 체중으로 만든 제안, 둘 다 없으면 빈 응답)
 *   PUT    /api/diet/goal                목표 저장 { kcal, proteinG, carbG, fatG, source: MANUAL|INBODY }
 *   DELETE /api/diet/goal                목표 지우기
 */
@RestController
@RequestMapping("/api/diet")
@RequiredArgsConstructor
public class DietController {
    private final DietService dietService;
    private final FoodCatalogService foodCatalogService;
    private final FoodPhotoService foodPhotoService;
    private final BarcodeService barcodeService;
    private final MyFoodService myFoodService;
    private final UserRepository userRepository;

    @GetMapping("/day")
    public DietService.DayView day(@AuthenticationPrincipal String email,
                                   @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return dietService.day(me(email), date);
    }

    @GetMapping("/summary")
    public List<DietService.DaySummary> summary(@AuthenticationPrincipal String email,
                                                @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return dietService.summary(me(email), from, to);
    }

    @GetMapping("/recent-foods")
    public List<DietService.RecentFood> recentFoods(@AuthenticationPrincipal String email) {
        return dietService.recentFoods(me(email));
    }

    @GetMapping("/foods")
    public FoodCatalogService.SearchResult foods(@AuthenticationPrincipal String email, @RequestParam(required = false) String q) {
        me(email);
        if (q != null && q.length() > 40) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "검색어는 40자까지예요.");
        }
        return foodCatalogService.search(q);
    }

    @GetMapping("/barcode/{code}")
    public BarcodeService.BarcodeResult barcode(@AuthenticationPrincipal String email, @PathVariable String code) {
        return barcodeService.lookup(me(email), code);
    }

    @GetMapping("/my-foods")
    public List<MyFoodService.FoodView> myFoods(@AuthenticationPrincipal String email) {
        return myFoodService.list(me(email));
    }

    @PostMapping("/my-foods")
    public MyFoodService.FoodView saveMyFood(@AuthenticationPrincipal String email, @RequestBody MyFoodService.FoodRequest req) {
        return myFoodService.save(me(email), req);
    }

    @PutMapping("/my-foods/{id}")
    public MyFoodService.FoodView updateMyFood(@AuthenticationPrincipal String email, @PathVariable Long id,
                                               @RequestBody MyFoodService.FoodRequest req) {
        return myFoodService.update(me(email), id, req);
    }

    @DeleteMapping("/my-foods/{id}")
    public ResponseEntity<Void> deleteMyFood(@AuthenticationPrincipal String email, @PathVariable Long id) {
        myFoodService.delete(me(email), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/photo", consumes = "multipart/form-data")
    public FoodPhotoService.PhotoResult photo(@AuthenticationPrincipal String email, @RequestPart("image") MultipartFile image)
            throws IOException {
        return foodPhotoService.analyze(me(email), image == null ? null : image.getBytes());
    }

    @PostMapping("/entries")
    public ResponseEntity<DietService.EntryView> add(@AuthenticationPrincipal String email, @RequestBody DietService.EntryRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(dietService.add(me(email), req));
    }

    @PutMapping("/entries/{id}")
    public DietService.EntryView update(@AuthenticationPrincipal String email, @PathVariable Long id,
                                        @RequestBody DietService.EntryRequest req) {
        return dietService.update(me(email), id, req);
    }

    @DeleteMapping("/entries/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal String email, @PathVariable Long id) {
        dietService.delete(me(email), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/goal")
    public ResponseEntity<DietService.GoalView> goal(@AuthenticationPrincipal String email) {
        DietService.GoalView goal = dietService.goal(me(email));
        return goal == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(goal);
    }

    @PutMapping("/goal")
    public DietService.GoalView saveGoal(@AuthenticationPrincipal String email, @RequestBody DietService.GoalRequest req) {
        return dietService.saveGoal(me(email), req);
    }

    @DeleteMapping("/goal")
    public ResponseEntity<Void> deleteGoal(@AuthenticationPrincipal String email) {
        dietService.deleteGoal(me(email));
        return ResponseEntity.noContent().build();
    }

    private User me(String email) {
        if (email == null || email.isBlank() || "anonymousUser".equals(email)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        }
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요."));
    }
}
