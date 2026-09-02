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

```bash
# 0) 로컬/임시 DB 를 쓴다. 운영 DB 에서 돌리지 말 것.
export DATABASE_URL="postgresql://user:pw@localhost:5432/muscleup_bench"

# 1) 합성 데이터 (표당 20만 행)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/sql/bench/seed_200k.sql

# 2) 인덱스 없는 상태로 먼저 잰다
psql "$DATABASE_URL" -f backend/sql/bench/explain.sql > backend/sql/bench/results/before.txt

# 3) 인덱스를 만든다
psql "$DATABASE_URL" -f backend/sql/migration_20260828_query_indexes.sql
psql "$DATABASE_URL" -c "ANALYZE brag_post; ANALYZE character_profiles; ANALYZE attendance_logs; ANALYZE program_applications;"

# 4) 다시 잰다
psql "$DATABASE_URL" -f backend/sql/bench/explain.sql > backend/sql/bench/results/after.txt

# 5) 정리
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/sql/bench/cleanup.sql
```

### 읽는 법 — 함정 두 개

**① `ANALYZE` 를 빼먹으면 인덱스를 만들어 놓고도 안 쓴다.**
플래너가 옛 통계로 계획을 세우기 때문이다. 3번의 `ANALYZE` 는 선택이 아니다.

**② 쿼리가 빨라진 배수와 사용자가 기다리는 시간은 다르다.**
Spring Data 의 `Page<T>` 는 목록과 함께 `count` 를 한 번 더 날린다. 인덱스는
정렬을 없애 주지만 count 는 여전히 전체를 세야 한다. `explain.sql` 의 5번 절이
그 count 를 따로 재는 이유다 — **쿼리가 몇백 배 빨라져도 페이지는 그만큼 안
빨라진다.** 다음 병목은 정렬이 아니라 count 이고, 커서 페이지네이션이나 근사
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

### 읽는 법

| 열 | 뜻 |
|---|---|
| `p50` / `p95` | ping 왕복. 설계 주기가 60ms 이므로 p95 가 그 근처를 넘어가면 체감이 깨진다 |
| `브로드캐스트/s` | 서버가 실제로 뿌린 횟수. 설계값은 1000/60 ≒ **16.7Hz** — 이 값이 떨어지면 서버가 주기를 못 지키고 있다는 뜻 |
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
