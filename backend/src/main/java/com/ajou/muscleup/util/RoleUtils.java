package com.ajou.muscleup.util;

import com.ajou.muscleup.entity.User;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;

/**
 * 역할 문자열 비교를 한곳에 모은다.
 * DB 에는 "ROLE_ADMIN" 으로 저장되지만 예전 데이터·코드에 "ADMIN" 도 섞여 있어 둘 다 관리자로 본다.
 */
public final class RoleUtils {

    private RoleUtils() {}

    public static boolean isAdminRole(String role) {
        if (role == null) return false;
        String r = role.trim();
        return "ROLE_ADMIN".equalsIgnoreCase(r) || "ADMIN".equalsIgnoreCase(r);
    }

    public static boolean isAdmin(User user) {
        return user != null && isAdminRole(user.getRole());
    }

    public static boolean isAdmin(Authentication auth) {
        if (auth == null || auth.getAuthorities() == null) return false;
        for (GrantedAuthority a : auth.getAuthorities()) {
            if (a != null && isAdminRole(a.getAuthority())) return true;
        }
        return false;
    }
}
