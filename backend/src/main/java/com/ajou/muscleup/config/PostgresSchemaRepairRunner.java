package com.ajou.muscleup.config;

import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class PostgresSchemaRepairRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        try {
            repairIfBytea("cms_events", "title", "varchar(120)");
            repairIfBytea("cms_events", "summary", "varchar(300)");
            repairIfBytea("cms_events", "content", "text");
        } catch (Exception e) {
            log.warn("schema repair skipped: {}", e.getMessage());
        }
    }

    private void repairIfBytea(String table, String column, String targetType) {
        List<String> types = jdbcTemplate.query(
                """
                select data_type
                from information_schema.columns
                where table_schema = 'public'
                  and table_name = ?
                  and column_name = ?
                """,
                (rs, rowNum) -> rs.getString(1),
                table,
                column
        );

        if (types.isEmpty()) {
            return;
        }

        String dataType = types.get(0);
        if (!"bytea".equalsIgnoreCase(dataType)) {
            return;
        }

        log.warn("repairing {}.{} from bytea to {}", table, column, targetType);
        jdbcTemplate.execute(
                "alter table " + table
                        + " alter column " + column
                        + " type " + targetType
                        + " using convert_from(" + column + ", 'UTF8')"
        );
    }
}
