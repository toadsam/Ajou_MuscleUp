package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.protein.*;
import com.ajou.muscleup.entity.Protein;
import com.ajou.muscleup.service.ProteinService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page; import org.springframework.data.domain.PageRequest; import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity; import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/proteins")
@RequiredArgsConstructor
public class ProteinController {
    private final ProteinService proteinService;

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody ProteinCreateUpdateRequest req) {
        Protein saved = proteinService.create(req);
        return ResponseEntity.ok(ProteinResponse.from(saved, 0.0));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody ProteinCreateUpdateRequest req) {
        return ResponseEntity.ok(ProteinResponse.from(
                proteinService.update(id, req), proteinService.averageRating(id)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        proteinService.delete(id);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable Long id) {
        Protein p = proteinService.get(id);
        return ResponseEntity.ok(ProteinResponse.from(p, proteinService.averageRating(id)));
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(required = false) String q,
                                  @RequestParam(defaultValue = "0") int page,
                                  @RequestParam(defaultValue = "12") int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Protein> result = proteinService.list(q, pageable);
        return ResponseEntity.ok(result.map(p -> ProteinResponse.from(p, proteinService.averageRating(p.getId()))));
    }
}
