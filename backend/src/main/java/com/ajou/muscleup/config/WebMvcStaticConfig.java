package com.ajou.muscleup.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
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
}

