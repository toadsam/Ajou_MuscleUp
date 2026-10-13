package com.ajou.muscleup.push;

import java.security.KeyPair;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

/**
 * VAPID 키(웹 푸시 서버 인증). 환경변수 PUSH_VAPID_PUBLIC_KEY · PUSH_VAPID_PRIVATE_KEY(base64url, `npx web-push generate-vapid-keys` 형식),
 * PUSH_VAPID_SUBJECT(연락처 — https 주소나 mailto:, 기본 https://musclehub.co.kr).
 * - 운영(prod)에 키가 없거나 틀리면 푸시를 끈다(화면에 "알림 준비 중").
 * - 개발에선 키가 없으면 켤 때마다 임시 키를 만든다(서버를 다시 켜면 구독을 다시 해야 함).
 */
@Slf4j
@Component
public class VapidKeys {
    private final ECPublicKey publicKey;
    private final ECPrivateKey privateKey;
    private final String publicKeyB64;
    private final String subject;

    public VapidKeys(Environment environment,
                     @Value("${push.vapid.public-key:}") String publicB64,
                     @Value("${push.vapid.private-key:}") String privateB64,
                     @Value("${push.vapid.subject:https://musclehub.co.kr}") String subject) {
        this.subject = subject == null || subject.isBlank() ? "https://musclehub.co.kr" : subject.trim();
        boolean prod = environment.acceptsProfiles(Profiles.of("prod"));
        ECPublicKey pub = null;
        ECPrivateKey priv = null;
        if (publicB64 != null && !publicB64.isBlank() && privateB64 != null && !privateB64.isBlank()) {
            try {
                pub = WebPushCrypto.decodePublic(WebPushCrypto.unb64(publicB64));
                priv = WebPushCrypto.decodePrivate(WebPushCrypto.unb64(privateB64));
            } catch (Exception e) {
                log.error("[push] PUSH_VAPID_PUBLIC_KEY / PUSH_VAPID_PRIVATE_KEY 형식이 맞지 않아 알림을 끕니다.");
                pub = null;
                priv = null;
            }
        } else if (prod) {
            log.warn("[push] PUSH_VAPID_PUBLIC_KEY / PUSH_VAPID_PRIVATE_KEY 가 없어 알림을 끕니다.");
        } else {
            KeyPair kp = WebPushCrypto.generateKeyPair();
            pub = (ECPublicKey) kp.getPublic();
            priv = (ECPrivateKey) kp.getPrivate();
            log.warn("[push] VAPID 키가 없어 개발용 임시 키를 만들었습니다(운영에서는 환경변수로 넣으세요).");
        }
        this.publicKey = pub;
        this.privateKey = priv;
        this.publicKeyB64 = pub == null ? null : WebPushCrypto.b64(WebPushCrypto.encodePublic(pub));
    }

    public boolean enabled() {
        return publicKey != null && privateKey != null;
    }

    /** 화면이 구독할 때 쓰는 공개 키(applicationServerKey) */
    public String publicKeyB64() {
        return publicKeyB64;
    }

    ECPrivateKey privateKey() {
        return privateKey;
    }

    String subject() {
        return subject;
    }
}
