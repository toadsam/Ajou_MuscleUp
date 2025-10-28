package com.ajou.muscleup.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/files")
public class FileController {

    private final Path root = Paths.get("uploads");

    @PostMapping("/upload")
    public ResponseEntity<Map<String, Object>> upload(@RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "EMPTY_FILE"));

        LocalDate today = LocalDate.now();
        Path dir = root.resolve(Paths.get(String.valueOf(today.getYear()), String.format("%02d", today.getMonthValue())));
        Files.createDirectories(dir);

        String original = StringUtils.cleanPath(Objects.requireNonNull(file.getOriginalFilename()));
        String ext = "";
        int dot = original.lastIndexOf('.');
        if (dot >= 0) ext = original.substring(dot);
        String filename = UUID.randomUUID() + ext;
        Path target = dir.resolve(filename);
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);

        String url = "/uploads/" + today.getYear() + "/" + String.format("%02d", today.getMonthValue()) + "/" + filename;
        return ResponseEntity.ok(Map.of(
                "url", url,
                "name", original,
                "size", file.getSize()
        ));
    }

    @GetMapping("/list")
    public ResponseEntity<List<String>> list() throws IOException {
        if (!Files.exists(root)) return ResponseEntity.ok(List.of());
        List<String> urls = Files.walk(root)
                .filter(Files::isRegularFile)
                .sorted(Comparator.comparingLong((Path p) -> p.toFile().lastModified()).reversed())
                .limit(200)
                .map(p -> root.relativize(p).toString().replace('\\', '/'))
                .map(rel -> "/uploads/" + rel)
                .collect(Collectors.toList());
        return ResponseEntity.ok(urls);
    }
}

