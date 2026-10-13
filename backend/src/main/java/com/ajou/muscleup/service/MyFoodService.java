package com.ajou.muscleup.service;

import com.ajou.muscleup.entity.MyFood;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.MyFoodRepository;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * 내 음식(본인만): 검색에 없는 음식을 이름 · 양 · 영양소 그대로 저장해 두고 다시 넣는다.
 * 같은 이름(띄어쓰기 · 대소문자 무시)으로 다시 저장하면 새 값으로 바꾼다 — 기록할 때 "내 음식으로 저장"을 켜 두면 늘 최신 값.
 */
@Service
@RequiredArgsConstructor
public class MyFoodService {
    public static final int MAX_FOODS = 100;

    private final MyFoodRepository repository;

    public record FoodRequest(String name, String amount, Integer kcal, Double proteinG, Double carbG, Double fatG) {}

    public record FoodView(Long id, String name, String amount, Integer kcal, Double proteinG, Double carbG, Double fatG) {
        static FoodView of(MyFood f) {
            return new FoodView(f.getId(), f.getName(), f.getAmount(), f.getKcal(), f.getProteinG(), f.getCarbG(), f.getFatG());
        }
    }

    @Transactional(readOnly = true)
    public List<FoodView> list(User me) {
        return repository.findAllByUser_IdOrderByNameAsc(me.getId()).stream().map(FoodView::of).toList();
    }

    /** 저장(같은 이름이 있으면 그 음식을 새 값으로) */
    @Transactional
    public FoodView save(User me, FoodRequest req) {
        String name = cleanName(req == null ? null : req.name());
        String key = key(name);
        MyFood food = repository.findAllByUser_IdOrderByNameAsc(me.getId()).stream()
                .filter(f -> key(f.getName()).equals(key)).findFirst().orElse(null);
        if (food == null) {
            if (repository.countByUser_Id(me.getId()) >= MAX_FOODS) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "내 음식은 " + MAX_FOODS + "개까지예요. 안 먹는 걸 지워 주세요.");
            }
            food = MyFood.builder().user(me).build();
        }
        apply(food, name, req);
        return FoodView.of(repository.save(food));
    }

    @Transactional
    public FoodView update(User me, Long id, FoodRequest req) {
        MyFood food = find(me, id);
        String name = cleanName(req == null ? null : req.name());
        String key = key(name);
        boolean taken = repository.findAllByUser_IdOrderByNameAsc(me.getId()).stream()
                .anyMatch(f -> !f.getId().equals(food.getId()) && key(f.getName()).equals(key));
        if (taken) throw new ResponseStatusException(HttpStatus.CONFLICT, "같은 이름의 내 음식이 있어요.");
        apply(food, name, req);
        return FoodView.of(food);
    }

    @Transactional
    public void delete(User me, Long id) {
        repository.delete(find(me, id));
    }

    private MyFood find(User me, Long id) {
        return repository.findByIdAndUser_Id(id, me.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "음식을 찾을 수 없어요."));
    }

    private static void apply(MyFood f, String name, FoodRequest req) {
        String amount = req.amount() == null ? null : req.amount().strip();
        if (amount != null && amount.length() > 30) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "양은 30자까지예요.");
        f.setName(name);
        f.setAmount(amount == null || amount.isEmpty() ? null : amount);
        f.setKcal(DietService.range(req.kcal(), 0, 5000, "칼로리"));
        f.setProteinG(DietService.grams(req.proteinG(), "단백질"));
        f.setCarbG(DietService.grams(req.carbG(), "탄수화물"));
        f.setFatG(DietService.grams(req.fatG(), "지방"));
    }

    private static String cleanName(String name) {
        String n = name == null ? "" : name.strip().replaceAll("\\s+", " ");
        if (n.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "음식 이름을 적어 주세요.");
        if (n.length() > 60) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "음식 이름은 60자까지예요.");
        return n;
    }

    private static String key(String name) {
        return name.replaceAll("\\s+", "").toLowerCase(Locale.ROOT);
    }
}
