package com.ajou.muscleup.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

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
    public ResponseEntity<Map<String, Object>> upload(@RequestParam("file") MultipartFile file,
                                                      @RequestParam(value = "folder", defaultValue = "gallery") String folder) throws IOException {
        if (file.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "EMPTY_FILE"));

        LocalDate today = LocalDate.now();
        Path dir = root.resolve(Paths.get(folder, String.valueOf(today.getYear()), String.format("%02d", today.getMonthValue())));
        Files.createDirectories(dir);

        String original = StringUtils.cleanPath(Objects.requireNonNull(file.getOriginalFilename()));
        String ext = "";
        int dot = original.lastIndexOf('.');
        if (dot >= 0) ext = original.substring(dot);
        String filename = UUID.randomUUID() + ext;
        Path target = dir.resolve(filename);
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);

        String relative = "/uploads/" + folder + "/" + today.getYear() + "/" + String.format("%02d", today.getMonthValue()) + "/" + filename;
        String baseUrl = ServletUriComponentsBuilder.fromCurrentContextPath().build().toUriString();
        String url = baseUrl + relative;
        return ResponseEntity.ok(Map.of(
                "url", url,
                "name", original,
                "size", file.getSize()
        ));
    }

    @DeleteMapping
    public ResponseEntity<Void> delete(@RequestParam("path") String path) throws IOException {
        // Accept either absolute URL or relative path under uploads/
        String sanitized = path;
        int idx = sanitized.indexOf("/uploads/");
        if (idx >= 0) {
            sanitized = sanitized.substring(idx + "/".length()); // keep uploads/... part
        }
        sanitized = sanitized.replace("\\", "/");
        if (sanitized.startsWith("/")) sanitized = sanitized.substring(1);
        if (!sanitized.startsWith("uploads/")) {
            return ResponseEntity.badRequest().build();
        }
        Path target = Paths.get(sanitized).normalize();
        if (target.startsWith("..")) {
            return ResponseEntity.badRequest().build();
        }
        Path file = root.getParent() == null ? target : root.getParent().resolve(target);
        Files.deleteIfExists(file);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/list")
    public ResponseEntity<List<String>> list(@RequestParam(value = "folder", defaultValue = "gallery") String folder) throws IOException {
        Path base = root.resolve(folder);
        if (!Files.exists(base)) return ResponseEntity.ok(List.of());
        List<String> urls = Files.walk(base)
                .filter(Files::isRegularFile)
                .sorted(Comparator.comparingLong((Path p) -> p.toFile().lastModified()).reversed())
                .limit(200)
                .map(p -> root.relativize(p).toString().replace('\\', '/'))
                .map(rel -> {
                    String relative = "/uploads/" + rel;
                    String baseUrl = ServletUriComponentsBuilder.fromCurrentContextPath().build().toUriString();
                    return baseUrl + relative;
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(urls);
    }

    @GetMapping("/list/paged")
    public ResponseEntity<Page<String>> listPaged(
            @RequestParam(value = "folder", defaultValue = "gallery") String folder,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size
    ) throws IOException {
        Path base = root.resolve(folder);
        if (!Files.exists(base)) return ResponseEntity.ok(Page.empty());

        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));
        List<String> all = Files.walk(base)
                .filter(Files::isRegularFile)
                .sorted(Comparator.comparingLong((Path p) -> p.toFile().lastModified()).reversed())
                .map(p -> root.relativize(p).toString().replace('\\', '/'))
                .map(rel -> {
                    String relative = "/uploads/" + rel;
                    String baseUrl = ServletUriComponentsBuilder.fromCurrentContextPath().build().toUriString();
                    return baseUrl + relative;
                })
                .collect(Collectors.toList());

        int from = Math.min(safePage * safeSize, all.size());
        int to = Math.min(from + safeSize, all.size());
        List<String> content = all.subList(from, to);
        return ResponseEntity.ok(new PageImpl<>(content, PageRequest.of(safePage, safeSize), all.size()));
    }
}
