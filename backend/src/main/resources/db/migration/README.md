# DB 데이터 이전 (Flyway)

`config/DataMigrationRunner.java` 가 **Hibernate(ddl-auto=update) 다음에** 실행한다.

- 새 테이블 · 칸 → 지금처럼 엔티티에 추가(Hibernate 가 만든다).
- 그 칸을 채우거나 옮기는 일(예: 아주대 짐 만들기, 기존 글에 gym_id 넣기), Hibernate 가 못 하는 변경(칸 이름 바꾸기 · 지우기 · 제약 조건) → 여기 SQL 로.

## 규칙
- 파일 이름: `V{번호}__{설명}.sql`. 번호는 공통 · DB 별 폴더를 통틀어 겹치지 않게 1씩 올린다.
- 두 DB(로컬 MySQL, 운영 Postgres)에서 같은 SQL 이 돌면 `common/`, 아니면 같은 번호로 `mysql/` · `postgresql/` 에 각각.
- **한 번 배포한 파일은 고치지 않는다**(체크섬이 바뀌면 서버가 안 뜬다). 고칠 일이 있으면 새 번호로.
- 여러 번 돌아도 같은 결과가 나오게(`WHERE ... IS NULL`, `NOT EXISTS`) 쓴다.
- 운영 배포 전: Railway 에서 DB 스냅샷.
