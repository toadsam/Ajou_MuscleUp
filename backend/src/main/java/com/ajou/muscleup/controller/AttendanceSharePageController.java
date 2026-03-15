package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.attendance.AttendanceShareResponse;
import com.ajou.muscleup.service.AttendanceService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

@RestController
@RequiredArgsConstructor
public class AttendanceSharePageController {
    private final AttendanceService attendanceService;

    @Value("${app.frontend-base-url:http://localhost:5173}")
    private String frontendBaseUrl;

    @GetMapping(value = "/share/attendance/{slug}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> sharePage(@PathVariable String slug) {
        AttendanceShareResponse data = attendanceService.getSharedBySlug(slug);

        String backendOrigin = ServletUriComponentsBuilder.fromCurrentContextPath().build().toUriString();
        String canonicalUrl = backendOrigin + "/share/attendance/" + slug;
        String targetUrl = frontendBaseUrl + "/attendance/share/" + slug;

        String title = (data.getAuthorNickname() == null || data.getAuthorNickname().isBlank()
                ? "출석 자랑"
                : data.getAuthorNickname() + "님의 출석 자랑")
                + " - MuscleUp";
        String description = buildDescription(data);

        List<String> media = data.getMediaUrls() == null ? List.of() : data.getMediaUrls();
        String firstMedia = media.isEmpty() ? null : media.get(0);
        String imageTag = "";
        String videoTag = "";
        if (firstMedia != null) {
            if (isVideo(firstMedia)) {
                videoTag = "<meta property=\"og:video\" content=\"" + esc(firstMedia) + "\" />";
            } else {
                imageTag = "<meta property=\"og:image\" content=\"" + esc(firstMedia) + "\" />";
            }
        }

        String html = """
                <!doctype html>
                <html lang="ko">
                <head>
                  <meta charset="utf-8" />
                  <meta name="viewport" content="width=device-width, initial-scale=1" />
                  <title>%s</title>
                  <meta name="description" content="%s" />
                  <link rel="canonical" href="%s" />
                  <meta property="og:type" content="article" />
                  <meta property="og:site_name" content="MuscleUp" />
                  <meta property="og:title" content="%s" />
                  <meta property="og:description" content="%s" />
                  <meta property="og:url" content="%s" />
                  %s
                  %s
                  <meta name="twitter:card" content="summary_large_image" />
                  <meta http-equiv="refresh" content="0; url=%s" />
                  <script>window.location.replace(%s);</script>
                </head>
                <body>
                  <p><a href="%s">출석 자랑 페이지로 이동</a></p>
                </body>
                </html>
                """
                .formatted(
                        esc(title),
                        esc(description),
                        esc(canonicalUrl),
                        esc(title),
                        esc(description),
                        esc(canonicalUrl),
                        imageTag,
                        videoTag,
                        esc(targetUrl),
                        jsString(targetUrl),
                        esc(targetUrl)
                );

        return ResponseEntity.ok(html);
    }

    private String buildDescription(AttendanceShareResponse data) {
        String base = data.isDidWorkout() ? "오늘 운동 완료" : "오늘은 휴식";
        if (data.getMemo() == null || data.getMemo().isBlank()) {
            return base + " 기록을 공유했어요.";
        }
        String trimmed = data.getMemo().trim();
        return base + " - " + (trimmed.length() > 120 ? trimmed.substring(0, 120) + "..." : trimmed);
    }

    private boolean isVideo(String url) {
        String lower = url.toLowerCase();
        return lower.contains(".mp4")
                || lower.contains(".mov")
                || lower.contains(".webm")
                || lower.contains(".m4v")
                || lower.contains(".avi")
                || lower.contains(".mkv");
    }

    private String esc(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("&", "&amp;")
                .replace("\"", "&quot;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");
    }

    private String jsString(String value) {
        String escaped = value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"");
        return "\"" + escaped + "\"";
    }
}
