package com.ajou.muscleup.config;

import jakarta.annotation.PostConstruct;
import java.sql.Connection;
import java.util.Locale;
import javax.sql.DataSource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.output.MigrateResult;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Component;

/**
 * DB 데이터 이전(Flyway)을 Hibernate 가 테이블을 맞춘 "뒤에" 돌린다.
 *
 * 지금 운영 DB 구조는 Hibernate(ddl-auto=update)가 만든다. 그래서 Spring Boot 기본 Flyway(JPA 보다 먼저 실행)를 끄고,
 * entityManagerFactory 가 준비된 다음 여기서 실행한다 — 새 칸은 엔티티가 만들고, 그 칸을 채우는 데이터 이전은 Flyway 가 한다.
 * 웹 서버는 모든 싱글턴 빈이 만들어진 뒤에 열리므로, 이전이 끝나기 전에는 요청을 받지 않는다. 이전이 실패하면 서버가 뜨지 않는다.
 *
 * - 공통 SQL: db/migration/common, DB 별 SQL: db/migration/mysql · db/migration/postgresql
 * - 처음 실행하면 기존 DB 를 버전 0 으로 기준선 처리하고 V1 부터 적용한다(flyway_schema_history 테이블이 생긴다).
 * - 나중에 운영 스키마를 내보내 기준선을 만들면 ddl-auto=validate 로 바꾸고 구조 변경도 Flyway 로 옮긴다(docs/design/stage0-gyms.md §5).
 */
@Slf4j
@Component
@DependsOn("entityManagerFactory")
@RequiredArgsConstructor
public class DataMigrationRunner {
    private final DataSource dataSource;

    @Value("${app.data-migrations.enabled:true}")
    private boolean enabled;

    @PostConstruct
    void migrate() {
        if (!enabled) {
            log.warn("데이터 이전(Flyway)이 꺼져 있습니다(app.data-migrations.enabled=false).");
            return;
        }
        String vendor = detectVendor();
        MigrateResult result = Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration/common", "classpath:db/migration/" + vendor)
                .baselineOnMigrate(true)
                .baselineVersion("0")
                .load()
                .migrate();
        if (result.migrationsExecuted == 0) {
            log.info("데이터 이전: 새로 적용할 것 없음 ({})", vendor);
        } else {
            log.info("데이터 이전 완료: {} 개 적용, 현재 버전 {} ({})", result.migrationsExecuted, result.targetSchemaVersion, vendor);
        }
    }

    private String detectVendor() {
        try (Connection c = dataSource.getConnection()) {
            String name = c.getMetaData().getDatabaseProductName().toLowerCase(Locale.ROOT);
            if (name.contains("postgres")) return "postgresql";
            if (name.contains("mysql") || name.contains("mariadb")) return "mysql";
            throw new IllegalStateException("지원하지 않는 DB: " + name);
        } catch (java.sql.SQLException e) {
            throw new IllegalStateException("DB 종류를 확인하지 못했습니다", e);
        }
    }
}
