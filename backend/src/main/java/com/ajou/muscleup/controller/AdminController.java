package com.ajou.muscleup.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    @GetMapping("/ping")
    public ResponseEntity<Map<String, Object>> ping() {
        return ResponseEntity.ok(Map.of("ok", true));
    }
}

