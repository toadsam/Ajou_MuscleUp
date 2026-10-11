package com.ajou.muscleup.config;

import com.ajou.muscleup.security.UploadFileTypes;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;

@Configuration
public class WebMvcStaticConfig implements WebMvcConfigurer {

    @Value("${app.upload-dir:uploads}")
    private String uploadDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String absoluteUploadDir = Paths.get(uploadDir).toAbsolutePath().normalize().toString().replace("\\", "/");
        if (!absoluteUploadDir.endsWith("/")) {
            absoluteUploadDir += "/";
        }

        // Serve files under /uploads/** from configured upload directory
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:" + absoluteUploadDir);
    }

    /**
     * /uploads/** 응답 보안 헤더.
     * - nosniff: 브라우저가 내용을 보고 형식을 추측(예: 이미지 이름의 HTML 을 HTML 로 실행)하지 못하게 한다.
     * - CSP sandbox: 예전에 올라간 HTML/SVG 가 직접 열려도 스크립트가 돌지 않게 한다.
     * - 사진이 아닌 파일(영상·예전 파일)은 attachment 로 내려 페이지로 열리지 않게 한다.
     *   (<video src> 재생은 Content-Disposition 과 관계없이 된다)
     */
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override
            public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
                response.setHeader("X-Content-Type-Options", "nosniff");
                response.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; media-src 'self'; sandbox");
                if (!UploadFileTypes.isImagePath(request.getRequestURI())) {
                    response.setHeader("Content-Disposition", "attachment");
                }
                return true;
            }
        }).addPathPatterns("/uploads/**");
    }
}

