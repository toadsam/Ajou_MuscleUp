package com.ajou.muscleup.controller;

import com.ajou.muscleup.security.UploadFileTypes;
import com.ajou.muscleup.util.RoleUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Object;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.file.*;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/files")
public class FileController {

    private final Path root;
    private final boolean s3Enabled;
    private final String s3Bucket;
    private final String s3Prefix;
    private final String s3PublicBaseUrl;
    private final String awsRegion;
    private final S3Client s3Client;

    public FileController(
            @Value("${app.upload-dir:uploads}") String uploadDir,
            @Value("${app.s3.enabled:false}") boolean s3Enabled,
            @Value("${app.s3.bucket:}") String s3Bucket,
            @Value("${app.s3.prefix:uploads}") String s3Prefix,
            @Value("${app.s3.public-base-url:}") String s3PublicBaseUrl,
            @Value("${app.s3.region:ap-northeast-2}") String awsRegion
    ) throws IOException {
        this.root = Paths.get(uploadDir).toAbsolutePath().normalize();
        Files.createDirectories(this.root);

        this.s3Enabled = s3Enabled;
        this.s3Bucket = s3Bucket == null ? "" : s3Bucket.trim();
        this.s3Prefix = trimSlashes(s3Prefix == null ? "uploads" : s3Prefix.trim());
        this.s3PublicBaseUrl = trimTrailingSlash(s3PublicBaseUrl == null ? "" : s3PublicBaseUrl.trim());
        this.awsRegion = (awsRegion == null || awsRegion.isBlank()) ? "ap-northeast-2" : awsRegion.trim();

        if (this.s3Enabled && !this.s3Bucket.isBlank()) {
            this.s3Client = S3Client.builder()
                    .region(Region.of(this.awsRegion))
                    .credentialsProvider(DefaultCredentialsProvider.create())
                    .build();
        } else {
            this.s3Client = null;
        }
    }

    @PostMapping("/upload")
    public ResponseEntity<Map<String, Object>> upload(@RequestParam("file") MultipartFile file,
                                                      @RequestParam(value = "folder", defaultValue = "gallery") String folder,
                                                      Authentication authentication) throws IOException {
        if (file.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "EMPTY_FILE"));

        String safeFolder = resolveFolder(folder);
        if (ADMIN_UPLOAD_FOLDERS.contains(safeFolder) && !RoleUtils.isAdmin(authentication)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "이 폴더에는 운영진만 올릴 수 있어요.");
        }
        LocalDate today = LocalDate.now();

        // 파일 이름 확장자·Content-Type 대신 앞부분 바이트로 형식을 판별하고, 저장 확장자도 판별 결과로 정한다.
        UploadFileTypes.Detected detected = detectType(file);
        if (detected == null) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "사진(JPG·PNG·WEBP·GIF·HEIC)이나 영상(MP4·MOV·WEBM)만 올릴 수 있어요.");
        }

        String original = StringUtils.cleanPath(Objects.requireNonNullElse(file.getOriginalFilename(), "file"));
        String filename = UUID.randomUUID() + "." + detected.extension();

        String relative = safeFolder + "/" + today.getYear() + "/" + String.format("%02d", today.getMonthValue()) + "/" + filename;
        String url;

        if (useS3()) {
            String key = toS3Key(relative);
            PutObjectRequest.Builder put = PutObjectRequest.builder()
                    .bucket(s3Bucket)
                    .key(key)
                    .contentType(detected.contentType());
            if (!detected.isImage()) {
                put.contentDisposition("attachment");
            }
            PutObjectRequest putObjectRequest = put.build();
            s3Client.putObject(putObjectRequest, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
            url = toPublicUrl(key);
        } else {
            Path dir = root.resolve(Paths.get(safeFolder, String.valueOf(today.getYear()), String.format("%02d", today.getMonthValue())));
            Files.createDirectories(dir);
            Path target = dir.resolve(filename);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            String localRelative = "/uploads/" + relative;
            String baseUrl = ServletUriComponentsBuilder.fromCurrentContextPath().build().toUriString();
            url = baseUrl + localRelative;
        }

        return ResponseEntity.ok(Map.of(
                "url", url,
                "name", original,
                "size", file.getSize()
        ));
    }

    @DeleteMapping
    public ResponseEntity<Void> delete(@RequestParam("path") String path) throws IOException {
        if (useS3()) {
            String key = toS3KeyFromPath(path);
            if (key == null || key.isBlank()) return ResponseEntity.badRequest().build();
            s3Client.deleteObject(DeleteObjectRequest.builder().bucket(s3Bucket).key(key).build());
            return ResponseEntity.noContent().build();
        }

        String normalized = path == null ? "" : path.trim().replace("\\", "/");
        String relative;
        int idx = normalized.indexOf("/uploads/");
        if (idx >= 0) {
            relative = normalized.substring(idx + "/uploads/".length());
        } else if (normalized.startsWith("uploads/")) {
            relative = normalized.substring("uploads/".length());
        } else if (normalized.startsWith("/uploads/")) {
            relative = normalized.substring("/uploads/".length());
        } else {
            return ResponseEntity.badRequest().build();
        }

        Path target = root.resolve(relative).normalize();
        if (!target.startsWith(root)) {
            return ResponseEntity.badRequest().build();
        }

        Files.deleteIfExists(target);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/proxy")
    public ResponseEntity<byte[]> proxy(@RequestParam("path") String path) throws IOException {
        if (useS3()) {
            String key = toS3KeyFromPath(path);
            if (key == null || key.isBlank()) {
                return ResponseEntity.badRequest().build();
            }
            try {
                ResponseBytes<GetObjectResponse> bytes = s3Client.getObjectAsBytes(
                        GetObjectRequest.builder().bucket(s3Bucket).key(key).build()
                );
                String contentType = bytes.response().contentType();
                if (contentType == null || contentType.isBlank()) {
                    contentType = "application/octet-stream";
                }
                return proxyResponse(key, contentType, bytes.asByteArray());
            } catch (Exception e) {
                return ResponseEntity.notFound().build();
            }
        }

        String relative = toLocalRelativePath(path);
        if (relative == null || relative.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        Path target = root.resolve(relative).normalize();
        if (!target.startsWith(root) || !Files.exists(target) || !Files.isRegularFile(target)) {
            return ResponseEntity.notFound().build();
        }

        byte[] bytes = Files.readAllBytes(target);
        String contentType = Files.probeContentType(target);
        if (contentType == null || contentType.isBlank()) {
            contentType = "application/octet-stream";
        }
        return proxyResponse(relative, contentType, bytes);
    }

    /** 프록시 응답: 형식 추측 금지(nosniff) + 사진이 아니면 내려받기로만. */
    private ResponseEntity<byte[]> proxyResponse(String path, String contentType, byte[] body) {
        ResponseEntity.BodyBuilder builder = ResponseEntity.ok()
                .header("Content-Type", contentType)
                .header("X-Content-Type-Options", "nosniff");
        if (!UploadFileTypes.isImagePath(path)) {
            builder.header("Content-Disposition", "attachment");
        }
        return builder.body(body);
    }

    @GetMapping("/list")
    public ResponseEntity<List<String>> list(@RequestParam(value = "folder", defaultValue = "gallery") String folder,
                                             Authentication authentication) throws IOException {
        String safeFolder = resolveListFolder(folder, authentication);
        if (useS3()) {
            String prefix = toS3Key(safeFolder) + "/";
            List<S3Object> objects = listS3Objects(prefix);
            List<String> urls = objects.stream()
                    .sorted(Comparator.comparing(S3Object::lastModified).reversed())
                    .limit(200)
                    .map(o -> toPublicUrl(o.key()))
                    .collect(Collectors.toList());
            return ResponseEntity.ok(urls);
        }

        Path base = root.resolve(safeFolder);
        if (!Files.exists(base)) return ResponseEntity.ok(List.of());
        List<String> urls = Files.walk(base)
                .filter(Files::isRegularFile)
                .sorted(Comparator.comparingLong((Path p) -> p.toFile().lastModified()).reversed())
                .limit(200)
                .map(p -> root.relativize(p).toString().replace('\\', '/'))
                .map(rel -> {
                    String localRelative = "/uploads/" + rel;
                    String baseUrl = ServletUriComponentsBuilder.fromCurrentContextPath().build().toUriString();
                    return baseUrl + localRelative;
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(urls);
    }

    @GetMapping("/list/paged")
    public ResponseEntity<Page<String>> listPaged(
            @RequestParam(value = "folder", defaultValue = "gallery") String folder,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            Authentication authentication
    ) throws IOException {
        String safeFolder = resolveListFolder(folder, authentication);
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));

        List<String> all;
        if (useS3()) {
            String prefix = toS3Key(safeFolder) + "/";
            all = listS3Objects(prefix).stream()
                    .sorted(Comparator.comparing(S3Object::lastModified).reversed())
                    .map(o -> toPublicUrl(o.key()))
                    .collect(Collectors.toList());
        } else {
            Path base = root.resolve(safeFolder);
            if (!Files.exists(base)) return ResponseEntity.ok(Page.empty());
            all = Files.walk(base)
                    .filter(Files::isRegularFile)
                    .sorted(Comparator.comparingLong((Path p) -> p.toFile().lastModified()).reversed())
                    .map(p -> root.relativize(p).toString().replace('\\', '/'))
                    .map(rel -> {
                        String localRelative = "/uploads/" + rel;
                        String baseUrl = ServletUriComponentsBuilder.fromCurrentContextPath().build().toUriString();
                        return baseUrl + localRelative;
                    })
                    .collect(Collectors.toList());
        }

        int from = Math.min(safePage * safeSize, all.size());
        int to = Math.min(from + safeSize, all.size());
        List<String> content = all.subList(from, to);
        return ResponseEntity.ok(new PageImpl<>(content, PageRequest.of(safePage, safeSize), all.size()));
    }

    private boolean useS3() {
        return s3Enabled && !s3Bucket.isBlank() && s3Client != null;
    }

    /**
     * 앱이 실제로 쓰는 업로드 폴더만 허용한다(그 외 값은 400).
     * gallery: 갤러리·단백질 인증 사진(UploadDropzone 기본값), attendance: 출석 인증, brag: 자랑방, events: 이벤트(운영진),
     * protein: 단백질 공구 인증(프론트가 아직 gallery 로 올림 — 옮길 자리).
     */
    private static final Set<String> ALLOWED_FOLDERS = Set.of("gallery", "attendance", "brag", "events", "protein");
    /** 운영진만 올릴 수 있는 폴더. */
    private static final Set<String> ADMIN_UPLOAD_FOLDERS = Set.of("events");
    /** 일반 회원이 목록을 볼 수 있는 폴더(공개 갤러리 화면). 나머지 폴더 목록은 운영진만. */
    private static final Set<String> USER_LISTABLE_FOLDERS = Set.of("gallery");

    private String resolveFolder(String folder) {
        String f = (folder == null || folder.isBlank()) ? "gallery" : folder.trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_FOLDERS.contains(f)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "허용되지 않은 폴더예요.");
        }
        return f;
    }

    private String resolveListFolder(String folder, Authentication authentication) {
        String f = resolveFolder(folder);
        if (!USER_LISTABLE_FOLDERS.contains(f) && !RoleUtils.isAdmin(authentication)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "이 폴더 목록은 운영진만 볼 수 있어요.");
        }
        return f;
    }

    private UploadFileTypes.Detected detectType(MultipartFile file) throws IOException {
        try (InputStream in = file.getInputStream()) {
            byte[] head = in.readNBytes(UploadFileTypes.HEADER_BYTES);
            return UploadFileTypes.detect(head);
        }
    }

    private String toS3Key(String relativePath) {
        String rp = trimSlashes(relativePath.replace("\\", "/"));
        if (s3Prefix.isBlank()) return rp;
        return s3Prefix + "/" + rp;
    }

    private String toPublicUrl(String key) {
        if (!s3PublicBaseUrl.isBlank()) {
            return s3PublicBaseUrl + "/" + key;
        }
        return "https://" + s3Bucket + ".s3." + awsRegion + ".amazonaws.com/" + key;
    }

    private String toS3KeyFromPath(String path) {
        if (path == null || path.isBlank()) return null;
        String candidate = path.trim();

        if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
            try {
                candidate = URI.create(candidate).getPath();
            } catch (Exception ignored) {
                return null;
            }
        }

        candidate = candidate.replace("\\", "/");
        while (candidate.startsWith("/")) candidate = candidate.substring(1);

        if (candidate.startsWith("uploads/")) {
            return toS3Key(candidate.substring("uploads/".length()));
        }

        if (!s3Prefix.isBlank() && candidate.startsWith(s3Prefix + "/")) {
            return candidate;
        }

        return toS3Key(candidate);
    }

    private String toLocalRelativePath(String path) {
        if (path == null || path.isBlank()) return null;
        String candidate = path.trim();

        if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
            try {
                candidate = URI.create(candidate).getPath();
            } catch (Exception ignored) {
                return null;
            }
        }

        candidate = candidate.replace("\\", "/");
        int idx = candidate.indexOf("/uploads/");
        if (idx >= 0) {
            return candidate.substring(idx + "/uploads/".length());
        }
        if (candidate.startsWith("/uploads/")) {
            return candidate.substring("/uploads/".length());
        }
        if (candidate.startsWith("uploads/")) {
            return candidate.substring("uploads/".length());
        }
        return null;
    }

    private List<S3Object> listS3Objects(String prefix) {
        List<S3Object> objects = new ArrayList<>();
        String token = null;
        do {
            ListObjectsV2Request request = ListObjectsV2Request.builder()
                    .bucket(s3Bucket)
                    .prefix(prefix)
                    .continuationToken(token)
                    .maxKeys(1000)
                    .build();
            ListObjectsV2Response response = s3Client.listObjectsV2(request);
            objects.addAll(response.contents());
            token = response.isTruncated() ? response.nextContinuationToken() : null;
        } while (token != null);
        return objects;
    }

    private String trimSlashes(String v) {
        String out = v == null ? "" : v;
        while (out.startsWith("/")) out = out.substring(1);
        while (out.endsWith("/")) out = out.substring(0, out.length() - 1);
        return out;
    }

    private String trimTrailingSlash(String v) {
        String out = v == null ? "" : v;
        while (out.endsWith("/")) out = out.substring(0, out.length() - 1);
        return out;
    }
}
