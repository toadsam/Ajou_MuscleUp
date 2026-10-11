# 2026-10-11 · 0단계 PR 2 — Flyway(데이터 이전 전용) 도입

설계: [../design/stage0-gyms.md](../design/stage0-gyms.md) §5.

## 왜
3번 PR(짐 구조)에서 "아주대 짐 만들기 · 기존 글에 gym_id 넣기 · LEADER → OWNER" 같은 **데이터 이전**을 운영 DB 에 한 번만, 기록을 남기며 해야 한다.
지금은 Hibernate `ddl-auto=update` 뿐이라 테이블 · 칸은 만들어도 데이터는 못 옮긴다.

## 고친 코드
- `backend/build.gradle` — `flyway-core`, `flyway-mysql`, `flyway-database-postgresql`(버전은 Spring Boot 3.5 관리).
- `BackendApplication.java` — `@SpringBootApplication(..., exclude = FlywayAutoConfiguration.class)`.
  Boot 기본 Flyway 는 JPA 보다 **먼저** 돌아, 아직 Hibernate 가 안 만든 칸을 채우는 이전이 실패한다. 처음엔 `spring.flyway.enabled=false` 로 껐는데,
  테스트 리소스의 `application.properties` 가 본 설정 파일을 덮어써 적용되지 않았다(테스트 실패: "non-empty schema but no schema history table") → 코드에서 제외.
- 새 `config/DataMigrationRunner.java` — `@DependsOn("entityManagerFactory")` + `@PostConstruct` 에서 Flyway 실행.
  DB 종류(연결 메타데이터)로 `db/migration/common` + `db/migration/{mysql|postgresql}` 위치를 고른다. `baselineOnMigrate(true)`, `baselineVersion("0")`.
  `app.data-migrations.enabled`(기본 true, 환경변수 `DATA_MIGRATIONS_ENABLED`)로 끌 수 있다.
- `db/migration/common/V1__start_data_migrations.sql` — `SELECT 1;`(기록 시작만).
- `db/migration/README.md` — 규칙(배포한 파일은 고치지 않기 · 여러 번 돌아도 같은 결과 · 배포 전 스냅샷).

## 확인
- 백엔드 테스트 전부 통과(로컬 MySQL 테스트 DB): 로그 "데이터 이전 완료: 1 개 적용, 현재 버전 1 (mysql)".
- **임시 Postgres**(이 PC 의 PostgreSQL 17 실행 파일로 작업 폴더에 따로 띄움, 기존 DB 무관):
  - 1차: Hibernate 가 테이블 35개 생성 → 기준선(버전 0) + V1 적용.
  - 2차: "새로 적용할 것 없음", 기존 테이블 그대로.
  - `flyway_schema_history`: `0 | << Flyway Baseline >> | BASELINE` · `1 | start data migrations | SQL`.

## 남은 것
- 운영(Railway Postgres) 첫 배포 때 `flyway_schema_history` 테이블이 생긴다(데이터 변경 없음). 스냅샷 권장.
- 나중에 운영 스키마와 엔티티를 비교해 `ddl-auto=validate` 로 전환(설계 §5 "나중").
