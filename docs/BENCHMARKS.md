# 측정 재현하기

이 저장소가 주장하는 성능 수치 두 가지를 **직접 다시 잴 수 있게** 만든 것들이다.
숫자를 문서에만 적어 두면 확인할 방법이 없고, 확인할 수 없는 숫자는 없는 것과 같다.

| 주장 | 재는 것 | 스크립트 |
|---|---|---|
| 목록 4개 인덱스 · 페이지 응답 개선 | EXPLAIN 계획·시간·인덱스 용량 | `backend/sql/bench/` |
| 라운지 동시접속 한계 | ping 왕복 p50/p95 · 팬아웃 대역폭 | `realtime/bench/` |

두 측정 다 **새 계측 코드를 앱에 넣지 않았다.** 이미 있는 것을 쓴다 —
DB 쪽은 리포지토리의 실제 쿼리, 실시간 쪽은 앱이 이미 가진 `ping:check` 왕복이다.

---

## 1. 목록 인덱스 (PostgreSQL)

### 무엇을 왜 재는가

아래 네 화면은 전부 `Pageable` 목록인데 정렬·필터 컬럼에 인덱스가 없었다.
인덱스가 없으면 DB 는 한 페이지(10건)를 주려고 표 전체를 읽어 정렬한다.

| 화면 | 쿼리 메서드 | 인덱스 |
|---|---|---|
| 자랑방 목록 | `findAllByOrderByCreatedAtDesc` | `idx_brag_post_created (created_at)` |
| 공개 캐릭터 랭킹 | `findByIsPublicTrueOrderByLevelDescUpdatedAtDesc` | `idx_character_public_rank (is_public, level, updated_at)` |
| 공유 인증 관리 | `findBySharedTrueOrderByReportCountDescUpdatedAtDesc` | `idx_attendance_shared_report (shared, report_count, updated_at)` |
| 프로그램 신청 | `findAllByOrderByCreatedAtDesc` | `idx_program_app_created (created_at)` |

지금 회원은 약 50명이라 **어느 화면도 느리지 않다.** 티가 나기 전에 확인해 두려고
표당 20만 행을 만들어 재는 것이다.

### 순서

표가 있는 DB 가 필요하다. 스키마는 마이그레이션이 아니라 **Hibernate 가 만든다**
(`ddl-auto=update`) — 빈 DB 를 만들고 앱을 그 DB 로 한 번 띄우면 표가 생긴다.

```bash
# 0) 로컬/임시 DB 를 쓴다. 운영 DB 에서 돌리지 말 것.
export DATABASE_URL="postgresql://user:pw@localhost:5432/muscleup_bench"

# 1) 표 만들기 — 앱을 그 DB 로 한 번 띄운다 (뜨고 나면 끈다)
cd backend && ./gradlew bootRun --args="\
  --spring.profiles.active=prod \
  --spring.datasource.url=jdbc:postgresql://localhost:5432/muscleup_bench \
  --spring.datasource.username=... --spring.datasource.password=..."

# 2) 인덱스를 떨어뜨린다 ⚠️ 1번에서 Hibernate 가 @Index 를 보고 이미 만들었다
psql "$DATABASE_URL" -c "DROP INDEX IF EXISTS idx_brag_post_created; \
  DROP INDEX IF EXISTS idx_character_public_rank; \
  DROP INDEX IF EXISTS idx_attendance_shared_report; \
  DROP INDEX IF EXISTS idx_program_app_created;"

# 3) 합성 데이터 (표당 20만 행)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/sql/bench/seed_200k.sql

# 4) 인덱스 없는 상태로 먼저 잰다 (7회 돌려 중앙값을 쓴다)
psql "$DATABASE_URL" -f backend/sql/bench/explain.sql > backend/sql/bench/results/before.txt

# 5) 인덱스를 만든다
psql "$DATABASE_URL" -f backend/sql/migration_20260828_query_indexes.sql

# 6) VACUUM ANALYZE — 표마다 따로. 한 번에 여러 문장을 주면 트랜잭션에 묶여 실패한다
for t in brag_post character_profiles attendance_logs program_applications; do
  psql "$DATABASE_URL" -c "VACUUM ANALYZE $t;"
done

# 7) 다시 잰다
psql "$DATABASE_URL" -f backend/sql/bench/explain.sql > backend/sql/bench/results/after_vacuumed.txt

# 8) 정리
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/sql/bench/cleanup.sql
```

### 실측 결과 (2026-09-02 · PostgreSQL 17.4 · 표당 20만 행 · 각 7회 중앙값)

| 쿼리 | 인덱스 없음 | 인덱스+VACUUM | 배수 |
|---|---:|---:|---:|
| 자랑방 목록 | 60.21ms | 0.084ms | 717× |
| 공개 캐릭터 랭킹 | 58.56ms | 0.045ms | 1301× |
| 공유 인증 관리 | 45.45ms | 0.068ms | 668× |
| 프로그램 신청 | 56.87ms | 0.023ms | 2472× |
| **count(\*)** | **57.21ms** | **57.45ms** | **1× (안 변함)** |

네 목록 모두 `Parallel Seq Scan + Sort` → `Index Scan Backward` 로 바뀐다.
인덱스 넷이 먹는 디스크는 합쳐 **21MB**(표 넷 합계 239MB).

**한 페이지 = 목록 + count 이므로 117.4ms → 57.5ms, 즉 2.0배다.**
목록만 보면 700~2500배지만 사용자가 기다리는 시간은 절반까지만 준다.
이제 한 페이지의 99.9%가 count 다.

### 읽는 법 — 함정 네 개

**① `ANALYZE` 를 빼먹으면 인덱스를 만들어 놓고도 안 쓴다.**
플래너가 옛 통계로 계획을 세우기 때문이다. 6번의 `ANALYZE` 는 선택이 아니다.

**② `VACUUM` 을 빼먹으면 인덱스가 count 를 오히려 느리게 만든다.**
실제로 겪었다 — 대량 적재 직후 `ANALYZE` 만 하고 재니 count 가 **57ms → 147ms 로
2.6배 느려졌다.** 인덱스가 생기면서 플래너가 `Index Only Scan` 을 골랐는데,
visibility map 이 서 있지 않아 결국 힙을 다시 읽었기 때문이다(`Heap Fetches` 가 크다).
`VACUUM` 뒤에는 `Heap Fetches: 0` 이 되고 57ms 로 돌아온다. **인덱스를 넣었더니
느려졌다는 결론은 대개 VACUUM 을 안 한 것이다** — 계획의 `Heap Fetches` 를 먼저 볼 것.

**③ 앱을 띄워 표를 만들면 인덱스도 같이 생긴다.**
엔티티에 `@Index` 가 붙어 있고 `ddl-auto=update` 라, 스키마를 만들려고 앱을 한 번
띄우는 순간 인덱스 넷이 이미 만들어져 있다. 그 상태에서 잰 "before" 는 before 가
아니다. 2번의 `DROP INDEX` 가 그래서 있다.

**④ 쿼리가 빨라진 배수와 사용자가 기다리는 시간은 다르다.**
Spring Data 의 `Page<T>` 는 목록과 함께 `count` 를 한 번 더 날린다. 인덱스는
정렬을 없애 주지만 count 는 여전히 전체를 세야 한다. `explain.sql` 의 5번 절이
그 count 를 따로 재는 이유다 — **쿼리가 700배 빨라져도 페이지는 2배만
빨라진다**(위 표). 다음 병목은 정렬이 아니라 count 이고, 커서 페이지네이션이나 근사
카운트로 접근할 문제다.

인덱스가 먹는 디스크는 6번 절의 `pg_relation_size` 로 함께 나온다. 읽기를 벌고
쓰기와 용량을 내는 거래이므로, 이득만 적고 대가를 안 적으면 절반만 잰 것이다.

---

## 2. 라운지 동시접속 (Socket.IO)

### 무엇을 왜 재는가

이 프로젝트의 가설은 두 문장이었다 —
「실시간 상태를 Socket.IO 서버로 분리하면 다시 오는 이유가 생기면서 **서버도 감당
가능하다**」. 앞 절반은 화면으로 증명되는데 뒤 절반은 재기 전까지 아무것도 아니다.

`realtime/bench/lounge-ramp.mjs` 는 동시 접속을 25 → 300 으로 올리며
**앱이 이미 가진 `ping:check` / `ping:result` 왕복**(`realtime/src/server.ts`)으로
응답 시간을 잰다. 접속한 클라이언트는 실제 화면과 같은 `lounge:join` 을 보내고
(`growthParams` 19개 포함 — 이걸 비우면 페이로드가 작아져 실제보다 좋게 나온다)
`player:move` 로 브로드캐스트를 유발한다.

### 순서

```bash
cd realtime
npm install

# 터미널 A — 서버
npm run dev

# 터미널 B — 부하
npm run bench
# 또는
node bench/lounge-ramp.mjs --steps 25,50,100,150,200,300 --seconds 16 --repeats 3 --pid <서버 PID>
```

결과는 표로 찍히고 `bench/results/lounge-ramp.csv` 에 남는다.

### 실측 결과 (2026-09-02 · 한 대·루프백 · 16초 × 3회 중앙값)

| 명 | p50 | p95 | 브로드캐스트/s | 서버 송신 | 1인 수신 | 1인당 B | CPU |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 25 | 2ms | 7ms | 6.4 | 2.7MB/s | 110KB/s | 795 | 3.0% |
| 50 | 3ms | **9ms** | 7.7 | 12.2MB/s | 250KB/s | 795 | 4.7% |
| 100 | 8ms | **85ms** | 11.4 | 63.3MB/s | 648KB/s | 795 | 12.2% |
| 150 | 94ms | 443ms | 12.4 | 137.4MB/s | 938KB/s | 796 | 15.6% |
| 200 | 499ms | 1115ms | 12.7 | 216.8MB/s | 1110KB/s | 796 | 13.5% |
| 300 | 51435ms | 55818ms | 10.0 | 376.1MB/s | 1284KB/s | 797 | 18.9% |

**한계는 100명 근처다.** 50명까지는 p95 9ms 로 여유가 크지만, 100명에서 이미
p95 85ms 로 설계 주기 60ms 를 넘는다. 150에서 꺾이고 200부터는 초 단위,
300에서는 51초로 사실상 죽는다.

**원인이 숫자로 드러난다.** `1인당 B` 는 795 → 797 로 인원과 무관하게 **고정**인데
`서버 송신` 만 2.7 → 376MB/s 로 **140배** 뛴다. 인원에 비례해야 할 것이 제곱으로
크고 있다는 뜻 — 매 틱 전원에게 전원 목록을 보내기 때문이다.

**그리고 CPU 는 무너질 때도 18.9% 밖에 안 된다.** 연산이 막힌 게 아니라 못 보내서
노는 것이다. 그래서 서버를 늘려도 해결되지 않는다 — 고칠 곳은 페이로드다.

### 읽는 법

| 열 | 뜻 |
|---|---|
| `p50` / `p95` | ping 왕복. 설계 주기가 60ms 이므로 p95 가 그 근처를 넘어가면 체감이 깨진다 |
| `브로드캐스트/s` | 서버가 실제로 뿌린 횟수. **상한**이 1000/60 ≒ 16.7Hz 다 — 다만 서버는 매 틱 무조건 보내지 않고 **변한 게 있을 때만** 보낸다(`server.ts` 의 `pendingBroadcast` 게이트). 그래서 한산할수록 낮게 나오고(25명 6.4), 사람이 늘수록 상한에 가까워진다(200명 12.7). **낮다고 못 따라가는 게 아니다.** 못 따라가는 신호는 인원이 늘었는데 이 값이 **되레 떨어지는 것** — 300명에서 12.7 → 10.0 으로 꺾인 지점이 그것이다 |
| `1인 수신` | 클라이언트 한 명이 초당 받는 바이트. **모바일에서 먼저 죽는 건 서버가 아니라 이쪽이다** |
| `서버 송신` | 1인 수신 × 접속 수 = 팬아웃 총량 |
| `1인당 B` | `lounge:players` 한 번의 크기 ÷ 그 안의 플레이어 수 |

**CPU 를 같이 보는 이유:** 무너질 때 CPU 가 *내려가면* 연산이 막힌 게 아니라
못 보내서 노는 것이다. 그때 RSS 가 오르면 큐가 쌓인다는 뜻이고, 원인은 구조 —
매 틱 전원에게 전원 목록을 보내니 바이트가 N² 로 큰다. `--pid` 를 주지 않으면
CPU/RSS 는 `-` 로 남는다. 못 잰 값을 지어내지 않기 위해서다.

### 조건을 반드시 함께 적을 것

한 대에서 서버와 클라이언트를 같이 돌리면 **네트워크가 빠지고**(루프백)
클라이언트 자신이 CPU 를 먹는다. 그 조건에서 나온 값은 실제 배포 환경보다
좋게 나온다 — 특히 `1인 수신` 은 LTE 사용자에게 그대로 적용되지 않는다.
결과를 어디에 옮기든 **「한 대 · 루프백 · N초 × M회 중앙값」을 같이 적는다.**
