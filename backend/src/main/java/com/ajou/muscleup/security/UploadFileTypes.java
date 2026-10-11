package com.ajou.muscleup.security;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;

/**
 * 업로드 파일 형식 판별.
 *
 * 클라이언트가 보낸 파일 이름 확장자나 Content-Type 은 믿지 않는다. 파일 앞부분 바이트(매직 넘버)를 보고
 * 허용 목록(사진: jpg/png/webp/gif/heic, 영상: mp4/mov/webm) 중 하나일 때만 받는다.
 * 저장할 확장자와 Content-Type 도 판별한 결과로 정한다.
 */
public final class UploadFileTypes {

    private UploadFileTypes() {}

    public enum Kind { IMAGE, VIDEO }

    public record Detected(String extension, String contentType, Kind kind) {
        public boolean isImage() { return kind == Kind.IMAGE; }
    }

    /** 판별에 필요한 앞부분 바이트 수. */
    public static final int HEADER_BYTES = 32;

    private static final Set<String> IMAGE_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp", "gif", "heic");
    private static final Set<String> VIDEO_EXTENSIONS = Set.of("mp4", "mov", "webm");

    private static final Set<String> HEIC_BRANDS = Set.of("heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1");
    private static final Set<String> MP4_BRANDS = Set.of(
            "isom", "iso2", "iso3", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "dash", "M4V ", "M4A ", "mmp4", "3gp4", "3gp5", "3gp6", "3g2a", "f4v ");

    /** 앞부분 바이트로 형식을 판별한다. 허용 목록 밖이면 null. */
    public static Detected detect(byte[] head) {
        if (head == null || head.length < 12) return null;

        // JPEG: FF D8 FF
        if (u(head, 0) == 0xFF && u(head, 1) == 0xD8 && u(head, 2) == 0xFF) {
            return new Detected("jpg", "image/jpeg", Kind.IMAGE);
        }
        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (startsWith(head, 0, new int[]{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A})) {
            return new Detected("png", "image/png", Kind.IMAGE);
        }
        // GIF: "GIF87a" / "GIF89a"
        String first6 = ascii(head, 0, 6);
        if ("GIF87a".equals(first6) || "GIF89a".equals(first6)) {
            return new Detected("gif", "image/gif", Kind.IMAGE);
        }
        // WEBP: "RIFF" .... "WEBP"
        if ("RIFF".equals(ascii(head, 0, 4)) && "WEBP".equals(ascii(head, 8, 4))) {
            return new Detected("webp", "image/webp", Kind.IMAGE);
        }
        // WEBM(Matroska/EBML): 1A 45 DF A3
        if (startsWith(head, 0, new int[]{0x1A, 0x45, 0xDF, 0xA3})) {
            return new Detected("webm", "video/webm", Kind.VIDEO);
        }
        // ISO BMFF: [size(4)] "ftyp" [major brand(4)]
        if ("ftyp".equals(ascii(head, 4, 4))) {
            String brand = ascii(head, 8, 4);
            if (HEIC_BRANDS.contains(brand)) {
                return new Detected("heic", "image/heic", Kind.IMAGE);
            }
            if ("qt  ".equals(brand)) {
                return new Detected("mov", "video/quicktime", Kind.VIDEO);
            }
            if (MP4_BRANDS.contains(brand)) {
                return new Detected("mp4", "video/mp4", Kind.VIDEO);
            }
            return null;
        }
        // 오래된 QuickTime: ftyp 없이 moov/mdat/wide/free 상자로 시작
        String atom = ascii(head, 4, 4);
        if ("moov".equals(atom) || "mdat".equals(atom) || "wide".equals(atom) || "free".equals(atom)) {
            return new Detected("mov", "video/quicktime", Kind.VIDEO);
        }
        return null;
    }

    /** 저장된 파일 경로의 확장자가 사진인지(공개 서빙 때 inline 으로 둘지 정할 때 쓴다). */
    public static boolean isImagePath(String path) {
        String ext = extensionOf(path);
        return ext != null && IMAGE_EXTENSIONS.contains(ext);
    }

    public static boolean isAllowedPath(String path) {
        String ext = extensionOf(path);
        return ext != null && (IMAGE_EXTENSIONS.contains(ext) || VIDEO_EXTENSIONS.contains(ext));
    }

    private static String extensionOf(String path) {
        if (path == null) return null;
        int q = path.indexOf('?');
        String p = q >= 0 ? path.substring(0, q) : path;
        int slash = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
        int dot = p.lastIndexOf('.');
        if (dot < 0 || dot < slash) return null;
        return p.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private static int u(byte[] b, int i) {
        return b[i] & 0xFF;
    }

    private static boolean startsWith(byte[] b, int offset, int[] sig) {
        if (b.length < offset + sig.length) return false;
        for (int i = 0; i < sig.length; i++) {
            if (u(b, offset + i) != sig[i]) return false;
        }
        return true;
    }

    private static String ascii(byte[] b, int offset, int len) {
        if (b.length < offset + len) return "";
        return new String(Arrays.copyOfRange(b, offset, offset + len), StandardCharsets.ISO_8859_1);
    }
}
