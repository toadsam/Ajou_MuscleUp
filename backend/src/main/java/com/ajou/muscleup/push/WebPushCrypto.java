package com.ajou.muscleup.push;

import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.AlgorithmParameters;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.ECPublicKeySpec;
import java.util.Arrays;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * 웹 푸시 암호(JDK 만 사용, 라이브러리 없음).
 * - 본문 암호화: RFC 8291(Message Encryption for Web Push) + RFC 8188 aes128gcm, 레코드 하나.
 * - 서버 인증: RFC 8292 VAPID — ES256 JWT.
 * 키 형식은 브라우저 · web-push 도구와 같다: 공개 키 = 비압축 점 65바이트, 개인 키 = d 32바이트, 둘 다 base64url(패딩 없음).
 */
public final class WebPushCrypto {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder B64D = Base64.getUrlDecoder();
    static final int RECORD_SIZE = 4096;

    private WebPushCrypto() {}

    public static ECParameterSpec p256() {
        try {
            AlgorithmParameters params = AlgorithmParameters.getInstance("EC");
            params.init(new ECGenParameterSpec("secp256r1"));
            return params.getParameterSpec(ECParameterSpec.class);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    public static KeyPair generateKeyPair() {
        try {
            KeyPairGenerator g = KeyPairGenerator.getInstance("EC");
            g.initialize(new ECGenParameterSpec("secp256r1"), RANDOM);
            return g.generateKeyPair();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    /** 비압축 점(0x04 || X || Y) 65바이트 */
    public static byte[] encodePublic(ECPublicKey key) {
        byte[] out = new byte[65];
        out[0] = 4;
        copyUnsigned(key.getW().getAffineX(), out, 1);
        copyUnsigned(key.getW().getAffineY(), out, 33);
        return out;
    }

    public static ECPublicKey decodePublic(byte[] raw) throws GeneralSecurityException {
        if (raw.length != 65 || raw[0] != 4) throw new GeneralSecurityException("공개 키 형식이 아니에요(65바이트 비압축 점).");
        BigInteger x = new BigInteger(1, Arrays.copyOfRange(raw, 1, 33));
        BigInteger y = new BigInteger(1, Arrays.copyOfRange(raw, 33, 65));
        return (ECPublicKey) KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(new ECPoint(x, y), p256()));
    }

    public static byte[] encodePrivate(ECPrivateKey key) {
        byte[] out = new byte[32];
        copyUnsigned(key.getS(), out, 0);
        return out;
    }

    public static ECPrivateKey decodePrivate(byte[] d) throws GeneralSecurityException {
        if (d.length != 32) throw new GeneralSecurityException("개인 키 형식이 아니에요(32바이트).");
        return (ECPrivateKey) KeyFactory.getInstance("EC").generatePrivate(new ECPrivateKeySpec(new BigInteger(1, d), p256()));
    }

    public static String b64(byte[] v) {
        return B64.encodeToString(v);
    }

    public static byte[] unb64(String v) {
        return B64D.decode(v.trim().replace('+', '-').replace('/', '_').replace("=", ""));
    }

    /**
     * 본문 암호화(aes128gcm). uaPublic = 구독의 p256dh(65바이트), authSecret = 구독의 auth(16바이트).
     * 돌려주는 값이 그대로 요청 본문(헤더: 소금 16 · 레코드 크기 4 · 키 길이 1 · 서버 임시 공개 키 65, 그다음 암호문).
     */
    public static byte[] encrypt(byte[] plaintext, byte[] uaPublic, byte[] authSecret) throws GeneralSecurityException {
        return encrypt(plaintext, uaPublic, authSecret, generateKeyPair(), randomBytes(16));
    }

    static byte[] encrypt(byte[] plaintext, byte[] uaPublic, byte[] authSecret, KeyPair asKeys, byte[] salt)
            throws GeneralSecurityException {
        if (plaintext.length > RECORD_SIZE - 17 - 86) throw new GeneralSecurityException("알림 내용이 너무 길어요.");
        byte[] asPublic = encodePublic((ECPublicKey) asKeys.getPublic());
        KeyAgreement ka = KeyAgreement.getInstance("ECDH");
        ka.init(asKeys.getPrivate());
        ka.doPhase(decodePublic(uaPublic), true);
        byte[] ecdhSecret = ka.generateSecret();

        byte[] keyInfo = concat("WebPush: info".getBytes(StandardCharsets.US_ASCII), new byte[] {0}, uaPublic, asPublic);
        byte[] ikm = hkdf(authSecret, ecdhSecret, keyInfo, 32);
        byte[] cek = hkdf(salt, ikm, concat("Content-Encoding: aes128gcm".getBytes(StandardCharsets.US_ASCII), new byte[] {0}), 16);
        byte[] nonce = hkdf(salt, ikm, concat("Content-Encoding: nonce".getBytes(StandardCharsets.US_ASCII), new byte[] {0}), 12);

        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
        byte[] ciphertext = c.doFinal(concat(plaintext, new byte[] {2})); // 마지막 레코드 구분자 0x02

        ByteBuffer header = ByteBuffer.allocate(16 + 4 + 1 + asPublic.length);
        header.put(salt).putInt(RECORD_SIZE).put((byte) asPublic.length).put(asPublic);
        return concat(header.array(), ciphertext);
    }

    /** 테스트용: 받는 쪽(브라우저)처럼 풀어 본다 */
    static byte[] decrypt(byte[] body, ECPrivateKey uaPrivate, byte[] uaPublic, byte[] authSecret) throws GeneralSecurityException {
        ByteBuffer b = ByteBuffer.wrap(body);
        byte[] salt = new byte[16];
        b.get(salt);
        b.getInt();
        int idLen = b.get() & 0xff;
        byte[] asPublic = new byte[idLen];
        b.get(asPublic);
        byte[] ciphertext = new byte[b.remaining()];
        b.get(ciphertext);
        KeyAgreement ka = KeyAgreement.getInstance("ECDH");
        ka.init(uaPrivate);
        ka.doPhase(decodePublic(asPublic), true);
        byte[] ecdhSecret = ka.generateSecret();
        byte[] keyInfo = concat("WebPush: info".getBytes(StandardCharsets.US_ASCII), new byte[] {0}, uaPublic, asPublic);
        byte[] ikm = hkdf(authSecret, ecdhSecret, keyInfo, 32);
        byte[] cek = hkdf(salt, ikm, concat("Content-Encoding: aes128gcm".getBytes(StandardCharsets.US_ASCII), new byte[] {0}), 16);
        byte[] nonce = hkdf(salt, ikm, concat("Content-Encoding: nonce".getBytes(StandardCharsets.US_ASCII), new byte[] {0}), 12);
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
        byte[] padded = c.doFinal(ciphertext);
        int end = padded.length - 1;
        while (end >= 0 && padded[end] == 0) end--;
        if (end < 0 || padded[end] != 2) throw new GeneralSecurityException("구분자가 없어요.");
        return Arrays.copyOf(padded, end);
    }

    /** VAPID JWT(ES256). audience = 푸시 서비스 주소의 origin(https://fcm.googleapis.com 등) */
    public static String vapidJwt(String audience, String subject, long expiresAtEpochSec, ECPrivateKey key) throws GeneralSecurityException {
        String header = b64("{\"typ\":\"JWT\",\"alg\":\"ES256\"}".getBytes(StandardCharsets.UTF_8));
        String claims = b64(("{\"aud\":\"" + jsonEscape(audience) + "\",\"exp\":" + expiresAtEpochSec + ",\"sub\":\""
                + jsonEscape(subject) + "\"}").getBytes(StandardCharsets.UTF_8));
        String signingInput = header + "." + claims;
        Signature s = Signature.getInstance("SHA256withECDSA");
        s.initSign(key);
        s.update(signingInput.getBytes(StandardCharsets.US_ASCII));
        return signingInput + "." + b64(derToRaw(s.sign()));
    }

    /** JDK 의 ECDSA 서명(DER)을 JWT 형식(R || S, 64바이트)으로 */
    static byte[] derToRaw(byte[] der) throws GeneralSecurityException {
        int i = 0;
        if (der[i++] != 0x30) throw new GeneralSecurityException("서명 형식이 아니에요.");
        int seqLen = der[i++] & 0xff;
        if (seqLen == 0x81) i++;
        byte[] out = new byte[64];
        for (int part = 0; part < 2; part++) {
            if (der[i++] != 0x02) throw new GeneralSecurityException("서명 형식이 아니에요.");
            int len = der[i++] & 0xff;
            byte[] v = Arrays.copyOfRange(der, i, i + len);
            i += len;
            copyUnsigned(new BigInteger(1, v), out, part * 32);
        }
        return out;
    }

    static byte[] hkdf(byte[] salt, byte[] ikm, byte[] info, int length) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(salt, "HmacSHA256"));
        byte[] prk = mac.doFinal(ikm);
        mac.init(new SecretKeySpec(prk, "HmacSHA256"));
        byte[] okm = mac.doFinal(concat(info, new byte[] {1}));
        return Arrays.copyOf(okm, length);
    }

    static byte[] randomBytes(int n) {
        byte[] b = new byte[n];
        RANDOM.nextBytes(b);
        return b;
    }

    private static void copyUnsigned(BigInteger v, byte[] out, int offset) {
        byte[] b = v.toByteArray();
        int len = Math.min(b.length, 32);
        System.arraycopy(b, b.length - len, out, offset + 32 - len, len);
    }

    private static byte[] concat(byte[]... parts) {
        int n = 0;
        for (byte[] p : parts) n += p.length;
        byte[] out = new byte[n];
        int o = 0;
        for (byte[] p : parts) {
            System.arraycopy(p, 0, out, o, p.length);
            o += p.length;
        }
        return out;
    }

    private static String jsonEscape(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
