# 2026-10-11 백엔드 데이터 영역 수정 기록

출석 무결성 · 성능(N+1) · 시간대 · 인덱스 · 공개 응답 · 경험치 API.
`B` = `backend/src/main/java/com/ajou/muscleup/`

## 한눈에

| # | 항목 | 결과 |
|---|------|------|
| 1 | 아무 날짜로 출석 생성 · 포인트 획득 | 완료 |
| 6 | 공개 공유글 응원/신고 숫자 부풀리기 | 완료(백엔드). 프론트 신고 요청에 로그인 쿠키 필요 |
| 9 | 주간 연속 출석 랭킹 N+1 | 완료(쿼리 1번 + 2분 캐시) |
| 10 | 연속 출석 계산이 하루마다 쿼리 1번 | 완료(120일 구간 쿼리) |
| 11 | 서버 시간대 | 완료(내 영역). 다른 영역 파일은 남은 것에 적음 |
| 12 | `workout_date` 인덱스 없음 | 완료 |
| 13 | 동시 출석 두 번 → 500 | 완료(한 번 더 시도해 멱등 처리, 그래도 겹치면 409) |
| 17 | 공개 공유 응답에 메모·신고 수·id 노출 | 완료(백엔드). 프론트 표시 정리 필요 |
| 18 | 모임 목록 N+1 · 초대코드 노출 · 비멤버에게 개인 출석 노출 | 완료. 헤더 숫자 0 은 프론트 문제 |
| 19 | AI 기록 limit 무제한/0 → 500, 랭킹 행마다 user 조회 | 완료 |
| 22 | 운영 DB(Postgres) + ddl-auto=update | 문서만(마이그레이션 계획 아래) |
| 23 | 경험치(EXP)가 API 에 없음 | 완료(필드 추가, 기존 필드 유지) |
| 26 | 3대 중량 랭킹이 본인 입력값 | 완료(`selfReported` 플래그만) |
| 30 | AI 기록 오류 문구 글자 깨짐 | 완료 |

---

### 1. 지난 날짜·미래 날짜로 출석을 새로 만들어 포인트를 받을 수 있음

- **문제**: `PUT /api/attendance/{date}` 에 아무 날짜나 넣으면 그 날짜 출석이 새로 만들어지고, 출석 포인트 + 연속 보너스 + 이벤트 진행도가 올라갔다. 과거 한 달을 채워 넣으면 연속 출석·레벨이 마음대로 올라간다.
- **원인**: `B/controller/AttendanceController.java` `upsertByDate` → `B/service/AttendanceServiceImpl.java` `upsertByDate` 가 `upsert(user, date, request)` 를 그대로 불렀고, `upsert` 는 기록이 없으면 새로 만들고 `calculatePointsEarned` 로 포인트를 줬다(구 289줄). 날짜 검사가 없었다. `EventServiceImpl.updateAttendanceProgress` 도 넘겨받은 날짜 기준으로 진행도를 올렸다.
- **고친 코드**
  - `B/service/AttendanceServiceImpl.java` — `upsertByDate`: 한국 시간 오늘 기준으로 날짜를 검사한다.
    ```diff
    -    @Transactional
    -    public AttendanceLogResponse upsertByDate(String email, LocalDate date, AttendanceUpsertRequest request) {
    -        User user = getUserOrThrow(email);
    -        UpsertResult result = upsert(user, date, request);
    +    public AttendanceLogResponse upsertByDate(String email, LocalDate date, AttendanceUpsertRequest request) {
    +        LocalDate today = LocalDate.now(clock);
    +        if (date.isAfter(today)) throw 400 "미래 날짜에는 출석을 기록할 수 없어요."
    +        if (date.isBefore(today.minusDays(1))) throw 400 "출석 기록은 오늘과 어제 것만 고칠 수 있어요."
    +        boolean allowCreate = date.equals(today);
    +        return upsertWithRetry(() -> doUpsert(email, date, request, allowCreate));
    ```
  - 같은 파일 `upsert(user, date, request, allowCreate)`: 기록이 없고 만들 수 없는 날짜(어제)면 404.
    ```diff
    +        if (existing == null && !allowCreate) {
    +            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
    +                    "이 날짜에는 출석 기록이 없어요. 출석은 그날 당일에만 남길 수 있어요.");
    +        }
    ```
  - 결과 규칙: 새 출석(포인트·연속 보너스 포함)은 "한국 시간 오늘"에만 생긴다(`POST /today`, 또는 오늘 날짜 PUT 에 기록이 없을 때). 어제 기록은 **이미 있는 것만** 고칠 수 있고, 수정은 원래부터 포인트 0. 이벤트 진행도도 이 경로를 통해서만 바뀌므로 `EventServiceImpl` 은 고칠 필요가 없었다.
  - 프론트 영향: `frontend/src/pages/Attendance.tsx` `saveToday` 는 `hasTodayLog ? PUT /api/attendance/${todayKey} : POST /api/attendance/today` 만 쓴다(오늘 날짜만). 정상 흐름은 그대로 동작한다. 단 `todayKey` 가 브라우저 로컬 날짜(`formatDateKey(new Date())`)라 해외 시간대 사용자는 날짜가 하루 어긋나면 400/404 를 받을 수 있다 → 프론트는 서버 오류 문구(한국어)를 그대로 보여 주면 된다.
- **확인**: `compileJava` 성공. 로그인이 필요한 경로라 직접 호출은 못 했다(아래 "확인 못 한 것").
- **남은 것**: 없음(프론트 변경 불필요).

### 13. 출석을 거의 동시에 두 번 누르면 500

- **문제**: 출석 버튼을 빠르게 두 번 누르거나 두 탭에서 동시에 저장하면 두 번째 요청이 500.
- **원인**: `upsert` 가 "조회 → 없으면 insert" 라 두 요청이 모두 "없음"을 보고 insert → `(user_id, workout_date)` UNIQUE 위반(`AttendanceLog.java` uniqueConstraints) → `DataIntegrityViolationException` 이 그대로 500.
- **고친 코드**
  - `B/service/AttendanceServiceImpl.java` — 새 `upsertWithRetry(Supplier)`: `upsertToday`/`upsertByDate` 에서 `@Transactional` 을 떼고 `TransactionTemplate` 으로 감쌌다. UNIQUE 위반이면 트랜잭션을 롤백한 뒤 **한 번 더** 돌린다. 두 번째에는 먼저 들어간 기록이 보이므로 "같은 내용 → 포인트 0" 또는 "수정" 경로로 끝난다(멱등). 그래도 겹치면 409.
    ```diff
    +        TransactionTemplate tx = new TransactionTemplate(transactionManager);
    +        try {
    +            response = tx.execute(status -> work.get());
    +        } catch (DataIntegrityViolationException first) {
    +            try {
    +                response = tx.execute(status -> work.get());
    +            } catch (DataIntegrityViolationException second) {
    +                throw new ResponseStatusException(HttpStatus.CONFLICT,
    +                        "같은 날 출석이 동시에 저장되고 있어요. 잠시 후 다시 시도해 주세요.");
    +            }
    +        }
    +        weeklyStreakSnapshot = null; // 출석이 바뀌었으니 주간 랭킹 캐시를 비운다.
    ```
    같은 트랜잭션 안에서 예외를 잡으면 트랜잭션이 rollback-only 로 남아 커밋 때 다시 터지기 때문에, 시도마다 새 트랜잭션을 쓴다.
- **확인**: 컴파일 성공. 동시 요청 재현은 로그인이 필요해 못 했다.
- **남은 것**: 없음.

### 6. 공개 공유글 응원·신고를 누구나 무한히 올릴 수 있음

- **문제**: 로그인 없이 `POST /api/attendance/share/{slug}/report` 를 반복하면 신고 수가 끝없이 오르고(관리자 화면이 신고 많은 순 정렬), 응원도 마찬가지. 동시에 누르면 숫자가 빠지기도 한다(읽고-더하고-저장).
- **원인**: `SecurityConfig` 77~78줄에서 두 경로가 permitAll(다른 영역 파일이라 그대로 둠), `AttendanceServiceImpl` 구 148~165줄이 `log.setCheerCount(log.getCheerCount() + 1)` / `setReportCount(+1)` 후 save.
- **고친 코드**
  - 새 파일 `B/entity/AttendanceShareReport.java` — 테이블 `attendance_share_reports(id, attendance_log_id, user_id, created_at, updated_at)`, UNIQUE `uk_attendance_share_report_log_user(attendance_log_id, user_id)`.
  - 새 파일 `B/repository/AttendanceShareReportRepository.java` — `existsByAttendanceLogIdAndUserId`.
  - 새 파일 `B/service/AttendanceCheerGuard.java` — 메모리 중복 방지. 키(`user:<email>` 또는 `ip:<IP>`) + slug 로 10분 안 재응원은 세지 않는다. 1만 개가 넘으면 만료된 키를 지운다.
  - `B/repository/AttendanceLogRepository.java` — DB 에서 한 번에 +1:
    ```diff
    +    @Modifying(flushAutomatically = true, clearAutomatically = true)
    +    @Query("update AttendanceLog l set l.cheerCount = l.cheerCount + 1 where l.id = :id")
    +    int incrementCheerCount(@Param("id") Long id);
    +    @Modifying(flushAutomatically = true, clearAutomatically = true)
    +    @Query("update AttendanceLog l set l.reportCount = l.reportCount + 1 where l.id = :id")
    +    int incrementReportCount(@Param("id") Long id);
    ```
  - `B/controller/AttendanceController.java`
    - `cheerBySlug(@AuthenticationPrincipal email, slug, HttpServletRequest)`: 로그인했으면 `user:<email>`, 아니면 `ip:<X-Forwarded-For 첫 값 또는 remoteAddr>` 를 키로 넘긴다.
    - `reportBySlug(@AuthenticationPrincipal email, slug)`: 로그인 안 했으면 401 "신고는 로그인한 뒤에 할 수 있어요.". permitAll 경로에서 비로그인 principal 은 null 이 아니라 `"anonymousUser"` 문자열이라 `isLoggedIn()` 으로 둘 다 거른다.
  - `B/service/AttendanceServiceImpl.java`
    - `addCheerBySlug(slug, viewerKey)`: `cheerGuard.tryCheer` 가 허용할 때만 `incrementCheerCount`, 아니면 현재 값만 돌려준다.
    - `reportBySlug(slug, email)`: 이미 신고했으면 숫자 그대로. 처음이면 신고 행 저장 + `incrementReportCount`. 동시에 두 번 → UNIQUE 위반을 잡아 현재 상태만 돌려준다(새 트랜잭션).
    - 숨김(hiddenByAdmin) 글은 신고도 404(예전엔 숨김 글도 신고 수가 올랐다).
  - `B/service/AttendanceService.java` — 시그니처 `addCheerBySlug(String slug, String viewerKey)`, `reportBySlug(String slug, String email)`.
- **확인**: 포트 8097 에 별도 백엔드를 띄워(local 프로필) 실제 호출.
  - 응원 연속 2번 → `cheerCount` 1 → 1(두 번째는 안 오름).
  - 비로그인 신고 → `401 {"message":"신고는 로그인한 뒤에 할 수 있어요."}`.
  - 로컬 DB 에 `attendance_share_reports` 테이블 생성 확인. 시험으로 올린 응원 1 은 DB 에서 0 으로 되돌렸다.
- **남은 것 (다른 영역 필요)**
  - 프론트 `frontend/src/pages/AttendanceShareView.tsx` `sendReaction`(1190줄 부근): `fetch(..., { method: "POST" })` 에 **`credentials: "include"`** 를 넣어야 로그인 쿠키가 실려 신고가 된다(지금은 항상 401). 401 이면 "로그인 후 신고할 수 있어요" 안내 + 로그인 이동.
  - 응답이 200 이어도 실제로 숫자가 안 올랐을 수 있다(중복). 프론트는 지금처럼 로컬에 "이미 누름"을 기억하면 된다.
  - 배포가 프록시 뒤라면 `server.forward-headers-strategy=framework` 설정(보안 영역)을 하면 IP 판별이 더 정확해진다. 지금은 `X-Forwarded-For` 첫 값을 쓰는데, 위조로 응원 중복 방지를 피할 수 있다(응원 수 정도라 허용).
  - 서버를 여러 대로 늘리면 응원 중복 방지는 대수만큼 느슨해진다(메모리). 신고는 DB 라 영향 없음.

### 17. 공개 공유 화면 응답에 메모·신고 수·내부 id 가 그대로 나감

- **문제**: 링크만 알면 누구나 `GET /api/attendance/share/{slug}` 로 본인용 메모(`memo`), 신고 수, 숨김 여부, DB id 를 볼 수 있었다. 카카오톡 등 링크 미리보기 설명에도 공유 문구가 없으면 메모가 실렸다.
- **원인**: 공개 엔드포인트가 작성자/관리자용 `AttendanceShareResponse` 를 그대로 돌려줌(`AttendanceShareResponse.java` `memo`, `reportCount`, `hiddenByAdmin`, `id`). `AttendanceSharePageController.buildDescription` 이 `shareComment` 가 비면 `data.getMemo()` 로 대체(구 93~96줄).
- **고친 코드**
  - 새 파일 `B/dto/attendance/AttendancePublicShareResponse.java` — `date, didWorkout, shareComment, workoutTypes, workoutIntensity, mediaUrls, authorNickname, cheerCount, lastEditedAt, updatedAt, shareSlug, currentStreak` 만. (`id, memo, reportCount, hiddenByAdmin` 제외)
  - `B/controller/AttendanceController.java` — `GET /share/{slug}`, `POST /share/{slug}/cheer`, `POST /share/{slug}/report` 의 반환형을 `AttendancePublicShareResponse` 로.
  - `B/service/AttendanceServiceImpl.java` — `toPublicShareResponse(log)`, `findVisibleSharedOrThrow(slug)`(없음/숨김 → 404 "공유된 출석 기록을 찾을 수 없어요.") 추가.
  - `B/controller/AttendanceSharePageController.java` — `buildDescription(AttendancePublicShareResponse)`:
    ```diff
    -        String source = data.getShareComment();
    -        if (source == null || source.isBlank()) {
    -            source = data.getMemo();
    -        }
    +        // 공개 문구(shareComment)만 쓴다. 예전에는 비어 있으면 본인용 메모(memo)를 링크 미리보기에 그대로 실었다.
    +        String source = data.getShareComment();
    ```
  - 작성자용(`POST /api/attendance/{date}/share`)과 관리자용(`/api/admin/attendance/shares`) 응답 `AttendanceShareResponse` 는 **그대로**.
- **확인**: 8097 인스턴스에서 `GET /api/attendance/share/bd8e…` 응답에 `memo/reportCount/hiddenByAdmin/id` 가 없음을 확인. `/share/attendance/{slug}` OG 설명이 `"Workout completed today on MuscleUp."`(메모 없음)으로 나옴. 없는 slug → 404 한국어 문구.
- **남은 것 (다른 영역 필요: 프론트)** `frontend/src/pages/AttendanceShareView.tsx`
  - `type ShareData`(19줄): `id`, `memo`, `reportCount` 를 옵션으로 바꾸거나 지운다.
  - 1389줄 `응원 {data.cheerCount} · 신고 {data.reportCount}` → 신고 수 표시를 지운다(지금은 "신고 undefined" 로 보임).
  - 1395~1397줄 "오늘의 메모" 블록(`data.memo || "메모 없음"`) → 지우거나 `shareComment` 로 바꾼다(이제 항상 "메모 없음").
  - 606, 802, 851, 912, 1386줄의 `data.memo` 대체값 → `shareComment` 만 쓰도록.

### 9. 출석 화면을 열 때마다 회원 수만큼 쿼리(주간 연속 출석 랭킹)

- **문제**: 출석 화면이 `GET /api/attendance/rankings/weekly-streak?limit=5` 를 부를 때마다 회원 전체를 읽고 회원마다 출석을 조회. 회원 1,000명이면 쿼리 1,001번.
- **원인**: `AttendanceServiceImpl.getWeeklyStreakRanking` 구 174~184줄 `userRepository.findAll().stream().map(user -> findByUserIdAndDateRangeOrderByDateAsc(...))`.
- **고친 코드**
  - `B/repository/AttendanceLogRepository.java` — `findWorkoutDaysWithNicknameBetween(start, end)`: `select u.id, u.nickname, l.date from AttendanceLog l join l.user u where l.didWorkout = true and l.date between …` (한 번).
  - `B/service/AttendanceServiceImpl.java` — `getWeeklyStreakRanking` → `computeWeeklyStreakRanking(today)` 를 메모리에서 계산하고 `WeeklyStreakSnapshot(today, computedAtMillis, items)` 에 2분(`WEEKLY_STREAK_CACHE_TTL`) 보관. 날짜가 바뀌거나 누가 출석을 저장하면(`upsertWithRetry`) 캐시를 비운다. 최대 50개만 들고 `limit` 만큼 잘라 준다.
  - 점수 규칙은 그대로(오늘부터 거꾸로 이어진 운동 일수, 오늘 안 했으면 0). 동점은 userId 순으로 고정.
  - 덤: `getMonthlyMediaRanking` 이 닉네임을 찾으려고 `userRepository.findAll()` 하던 것을 결과에 나온 회원만 `findAllById` 로.
- **확인**: 컴파일 + 기동 시 JPQL 검증 통과(8097 인스턴스 정상 기동). 엔드포인트가 로그인 필요라 응답은 못 봤다.
- **남은 것**: 서버 여러 대면 캐시가 대수별로 따로 돈다(최대 2분 차이).

### 10. 연속 출석 계산이 하루 거슬러 갈 때마다 쿼리 1번

- **문제**: 30일 연속 출석이면 출석 저장·요약·공유 화면마다 쿼리 31번.
- **원인**: `calculateCurrentStreak`(구 293~310줄) · `calculateStreakForDate`(구 514~531줄)가 `while(true) { findByUserAndDate(user, cursor) }`.
- **고친 코드**
  - `B/repository/AttendanceLogRepository.java` — `findDateFlagsByUserIdAndDateRange(userId, start, end)`: `(date, didWorkout)` 만 읽는 범위 쿼리.
  - `B/service/AttendanceServiceImpl.java` — `calculateStreakForDate(user, date)` 를 120일(`STREAK_WINDOW_DAYS`) 구간 한 번 읽어 세도록 바꿨다. 연속이 구간 끝까지 이어질 때만 다음 120일을 읽는다(정확도 유지). 의미가 같던 `calculateCurrentStreak` 는 지우고 `getSummary` 도 이 함수를 쓴다. 쓰지 않게 된 `calculateCurrentStreakInRange` 삭제.
    ```diff
    -        while (true) {
    -            AttendanceLog log = attendanceLogRepository.findByUserAndDate(user, cursor).orElse(null);
    +        while (true) {
    +            LocalDate windowStart = windowEnd.minusDays(STREAK_WINDOW_DAYS - 1L);
    +            for (Object[] row : attendanceLogRepository.findDateFlagsByUserIdAndDateRange(userId, windowStart, windowEnd)) {
    +                didWorkoutByDate.put((LocalDate) row[0], (Boolean) row[1]);
    +            }
    ```
- **확인**: 8097 인스턴스에서 공유글(3/29·3/30·3/31 연속 운동)의 `currentStreak` 가 3 으로 나옴 — DB 기록과 일치.
- **남은 것**: 없음.

### 11. 서버 시간대가 정해져 있지 않아 "오늘"이 하루 어긋날 수 있음

- **문제**: 운영 서버 기본 시간대가 UTC 이면 한국 시간 00:00~08:59 에 모임 출석률·챌린지 상태·이번 달 계산이 전날 기준이 된다.
- **원인**: `B/BackendApplication.java` 에 시간대 설정 없음. `CrewServiceImpl` 273~274·382·530줄 `LocalDate.now()`/`YearMonth.now()`, `CrewController` 167줄 `YearMonth.now()`, 가입 승인 시각 `LocalDateTime.now()`.
- **고친 코드**
  - `B/BackendApplication.java` — `main` 첫 줄 `TimeZone.setDefault(TimeZone.getTimeZone("Asia/Seoul"));`
  - 새 파일 `B/config/TimeConfig.java` — `Clock clock()` 빈(`Clock.system(Asia/Seoul)`), main 을 거치지 않는 테스트용으로 `@PostConstruct` 에서도 기본 시간대 설정.
  - `B/service/CrewServiceImpl.java` — `Clock clock` 주입. `LocalDate.now(clock)`, `YearMonth.now(clock)`, `YearMonth.from(today)`, `LocalDateTime.now(clock)` 로 전부 교체.
  - `B/controller/CrewController.java` — `parseMonthOrDefault` 의 `YearMonth.now()` → `YearMonth.now(clock)`.
  - `B/service/AttendanceServiceImpl.java` — 자체 `KST` 상수 대신 `Clock` 사용(`LocalDate.now(clock)`, `LocalDateTime.now(clock)`).
- **확인**: 컴파일 성공, 8097 기동 로그 시각이 `+09:00` 로 찍힘.
- **남은 것 (다른 영역 필요 / 배포 때)**
  - 기본 시간대가 KST 가 되면서 `LocalDateTime.now()` 를 쓰는 다른 영역 코드도 KST 가 된다: `FileController.java:87`(업로드 폴더 날짜), `AuditLogService.java:62`(`@Scheduled(cron)` 에 zone 없음 → 이제 KST 04:00), `RefreshTokenService.java:133`(cron, zone 없음), `EmailVerificationService`, `AdminController`, `GlobalExceptionHandler`. 의도대로면 그대로 두고, 명시적으로 하려면 각 영역에서 `zone = "Asia/Seoul"`/`Clock` 을 쓰면 된다.
  - **배포 주의**: 운영 서버가 지금까지 UTC 로 돌았다면 배포 전 저장된 `created_at/updated_at`(LocalDateTime) 은 UTC 벽시계, 배포 후는 KST 벽시계라 9시간 단절이 생긴다. 특히 `refresh_tokens` 만료 시각이 UTC 로 저장돼 있었다면 배포 직후 한 번 9시간 일찍 만료로 보일 수 있다(재로그인 1회). 정확히 맞추려면 배포 시 기존 행에 +9시간 보정 SQL 을 돌리거나, 반대로 `hibernate.jdbc.time_zone` 을 정해 두고 저장 기준을 통일해야 한다. 운영 서버의 현재 기본 시간대(`TZ`)를 먼저 확인할 것.

### 12. `attendance_logs` 에 날짜 인덱스가 없음

- **문제**: 오늘 출석 수(`countByDate`, 로비 지표), 월간 미디어 랭킹, 주간 랭킹처럼 날짜만으로 거르는 조회가 표 전체를 훑는다.
- **원인**: `B/entity/AttendanceLog.java` 21줄 UNIQUE `(user_id, workout_date)` 는 앞 칼럼이 `user_id` 라 날짜만 거르는 조회에 못 쓴다.
- **고친 코드**
  - `B/entity/AttendanceLog.java` — `@Table(indexes = …)` 에 추가:
    ```diff
    +                @Index(
    +                        name = "idx_attendance_date_user",
    +                        columnList = "workout_date, user_id"
    +                )
    ```
- **확인**: 8097 인스턴스 기동 후 로컬 MySQL `SHOW INDEX FROM attendance_logs` 에 `idx_attendance_date_user(workout_date, user_id)` 생성 확인.
- **남은 것**: 운영(`application-prod.properties` `ddl-auto=update`)은 배포 후 첫 기동 때 인덱스와 `attendance_share_reports` 테이블이 자동 생성된다. 행이 많으면 기동 중 인덱스 생성 시간이 걸릴 수 있다(지금 규모면 수 초 이하 예상). 아래 22번의 마이그레이션 도구로 옮기면 그때부터는 SQL 로 관리.

### 18. 모임 목록이 모임 수만큼 쿼리 · 초대코드가 누구에게나 · 비멤버도 개인 출석을 봄

- **문제**
  - `GET /api/crew/groups` 가 모임마다 인원 수·가입 여부·모임장을 따로 조회(모임 20개면 60번+).
  - 가입하지 않은 사람에게도 모든 모임의 초대코드를 내려줘 "승인 필요" 모임도 코드로 바로 들어갈 수 있었다.
  - 모임 상세(`GET /api/crew/groups/{id}`)에서 멤버가 아닌 사람도 멤버별 이번 달 출석 일수·출석률·챌린지 진행·경쟁 점수를 볼 수 있었다.
- **원인**: `CrewServiceImpl.list` 구 76~89줄 `findAll()` + `countByCrew`/`existsByCrewAndUser`/`crew.getOwner()`(lazy) 반복, `.inviteCode(crew.getInviteCode())`. `buildDetail` 이 `joined` 와 관계없이 모든 값을 채움.
- **고친 코드**
  - `B/repository/WorkoutCrewRepository.java` — `findAllWithOwner()`: `select c from WorkoutCrew c join fetch c.owner`.
  - `B/repository/WorkoutCrewMemberRepository.java` — `countMembersGroupByCrewId()`(모임별 인원 한 번에), `findCrewIdsByUserId(userId)`(내 모임 id 한 번에), `findAllByCrewOrderByCreatedAtAsc` 에 `@EntityGraph(attributePaths = "user")`.
  - `B/service/CrewServiceImpl.java`
    - `list`: 쿼리 3번으로. `.inviteCode(joined ? crew.getInviteCode() : null)`.
    - `buildDetail`: 누구에게나 보이는 집계 `memberCount`, `monthWorkoutTotal`, `averageAttendanceRate` 를 추가하고, 멤버가 아니면 `inviteCode=null`, `members`·`competitionBoard`·`kingTitles` 는 빈 목록, `challenges` 는 제목·기간·상태·목표만 두고 `members` 빈 목록. `memberDetailVisible` 로 알려 준다.
    - `buildChallengeResponse(challenge, members, profileMap)` 오버로드: 상세에서 챌린지마다 멤버·캐릭터를 다시 읽던 것을 한 번만 읽어 넘긴다.
    - `joinWithPolicy`: 승인 대기(PENDING) 결과에는 초대코드를 넣지 않는다.
  - `B/dto/crew/CrewDetailResponse.java` — 필드 추가: `memberCount`, `monthWorkoutTotal`, `averageAttendanceRate`, `memberDetailVisible`. 기존 필드는 그대로.
- **헤더 숫자 "내 모임 0 · 전체 모임 0 · 참여 인원 0"**: 백엔드 요약 API 는 없다. `frontend/src/pages/CrewHub.tsx` 140~150줄이 같은 목록(`groups`)에서 `joinedGroups.length`, `groups.length`, `memberCount` 합을 계산해 `CountNumber`(=`hooks/useCountUp.ts`)로 보여 준다. `useCountUp` 은 `requestAnimationFrame` 이 돌아야 0 에서 올라가는데, 탭이 백그라운드이거나 화면이 숨겨진 상태(점검 도구로 캡처할 때 등)에서는 rAF 가 멈춰 0 에 머문다. 목록은 그대로 보이므로 **프론트 문제**다.
- **확인**: 컴파일 + 8097 기동(JPQL 검증) 성공. 응답은 로그인이 필요해 못 봤다.
- **남은 것 (다른 영역 필요: 프론트)**
  - `useCountUp`: 문서가 숨김 상태(`document.hidden`)이거나 rAF 가 일정 시간 안 오면 바로 목표값으로 맞추기. 또는 `CrewHub` 헤더는 애니메이션 없이 숫자를 바로 표시.
  - `Crew.tsx:400`, `CrewChallenge.tsx:1264`: `detail.inviteCode` 가 null 이면 초대코드 줄과 복사 버튼을 숨기기.
  - `types/crew.ts` 20·44·106줄 `inviteCode: string` → `string | null`, `CrewDetail` 에 새 필드 4개(옵션).
  - 비멤버 상세 화면: `memberDetailVisible === false` 면 멤버별 표 대신 "참여하면 멤버별 출석을 볼 수 있어요" + `memberCount / monthWorkoutTotal / averageAttendanceRate` 표시.

### 19. AI 기록 limit 이 0 이하면 500, 너무 크면 전부 읽음 · 랭킹 행마다 회원 조회

- **원인**: `B/service/AiChatHistoryService.java` 46줄 `PageRequest.of(0, limit, …)` — 0 이하면 `IllegalArgumentException`(500), 상한 없음. `RankingServiceImpl.fetchLevelRankings` / `fetchThreeLiftRankings` 가 행마다 `profile.getUser().getNickname()`(lazy) → 100행이면 100번.
- **고친 코드**
  - `B/service/AiChatHistoryService.java` — `getRecent`:
    ```diff
    -        Pageable pageable = PageRequest.of(0, limit, Sort.by(Sort.Direction.DESC, "createdAt"));
    +        int safeLimit = Math.max(1, Math.min(limit, MAX_RECENT_LIMIT));   // MAX_RECENT_LIMIT = 50
    +        Pageable pageable = PageRequest.of(0, safeLimit, Sort.by(Sort.Direction.DESC, "createdAt"));
    ```
  - `B/repository/CharacterProfileRepository.java`
    - `findByIsPublicTrueOrderByLevelDescUpdatedAtDesc` 에 `@EntityGraph(attributePaths = "user")`.
    - `findPublicWithStatsOrderByThreeLiftDesc`: `select cp, s, u … join cp.user u …` 로 회원을 같이 고르고 `countQuery = "select count(cp) from CharacterProfile cp where cp.isPublic = true"` 명시.
  - `B/service/RankingServiceImpl.java` — `fetchThreeLiftRankings` 가 `row[2]`(User)에서 닉네임을 읽는다.
- **확인**: 컴파일 + 기동 성공(쿼리 검증 통과).
- **남은 것**: 없음.

### 23. 경험치(EXP)가 API 에 없어 "다음 레벨까지"를 보여 줄 수 없음

- **문제**: 캐릭터 응답에 레벨만 있고 출석 포인트·다음 레벨까지 남은 양이 없다. 체성분을 입력하지 않은 사람은 출석해도 레벨이 절대 안 오르는데 이유를 알 수 없다.
- **원인**: `B/dto/character/CharacterProfileResponse.java` 에 해당 필드 없음. `B/service/CharacterGrowthService.java` 33~36줄 — `UserBodyStats` 가 없으면 포인트만 쌓고 평가(`evaluate`)를 하지 않는다.
- **기존 규칙(바꾸지 않음)을 풀어 쓴 공식** — `CharacterServiceImpl.evaluateStats` / `calculateAttendanceBonus`
  - `totalScore(0..100)` = 3대 절대 점수(0..55) + 상대 근력(0..20) + 키 대비 근육량(0..15) + BMI·체지방(0..10) + `attendanceBonus`
  - `attendanceBonus = min(8, attendancePoints × 0.4)` (출석 포인트 20점에서 상한)
  - `level = 1 + floor(totalScore)` (최대 100)
  - `exp = floor((totalScore − (level − 1)) × 100)` → 이번 레벨 안 0..99, `expToNextLevel = 100 − exp`, `levelProgress = exp / 100`
  - `attendancePointsToNextLevel = ceil((1 − 진행분) / 0.4)` — 출석 보너스 상한까지 남은 몫으로 다음 레벨에 닿을 때만, 아니면 null.
- **고친 코드**
  - `B/dto/character/CharacterProfileResponse.java` — 필드 추가(기존 필드 유지): `attendancePoints`, `attendanceBonus`, `attendanceBonusMax`, `hasBodyStats`, `exp`, `expToNextLevel`, `levelProgress`, `attendancePointsToNextLevel`. 새 `record ExpInfo(...)` 와 `from(profile, growthParams, expInfo)` 오버로드. 기존 `from(profile, growthParams)` 는 그대로 동작.
  - `B/service/CharacterServiceImpl.java` — `toProfileResponse` 가 새 `buildExpInfo(profile, stats)` 결과를 넣는다. 체성분이 없으면 `hasBodyStats=false`, exp 계열 null. 몸무게가 범위 밖이라 평가가 안 되면 exp 계열 null. 레벨 100 이면 `levelProgress=1.0`, 나머지 null. 상수 `ATTENDANCE_POINT_SCORE = 0.4`, `ATTENDANCE_BONUS_MAX = 8.0` 로 이름만 붙였다(값 동일).
- **확인**: 컴파일 성공. `/api/character/me` 는 로그인 필요라 응답은 못 봤다.
- **남은 것 (프론트)**: 캐릭터/홈 화면에서 `exp/expToNextLevel/levelProgress` 로 진행 막대, `hasBodyStats=false` 면 "체성분을 입력해야 출석 포인트가 레벨에 반영돼요" 안내. 경제 규칙(체성분 없이도 레벨 오르게 할지)은 기획 결정이라 바꾸지 않았다.

### 26. 3대 중량 랭킹이 본인 입력값이라는 표시가 없음

- **고친 코드**: `B/dto/character/CharacterRankingResponse.java` 에 `boolean selfReported` 추가, `B/service/RankingServiceImpl.java` 의 레벨·3대 랭킹 항목 모두 `.selfReported(true)` (인증 절차가 없으니 지금은 항상 true. 레벨도 본인 입력 체성분·중량에서 계산되므로 같이 true).
- **확인**: 컴파일 성공.
- **남은 것 (프론트)**: 랭킹 화면에 "본인 입력 기준" 표시. 실제 검증(영상 인증 등)은 기획 필요라 보류.

### 30. AI 기록 오류 문구가 `�?록�?는 …` 처럼 깨져 보임

- **원인**: `B/service/AiChatHistoryService.java` 59·73·84·90줄 문자열이 인코딩이 깨진 채 커밋돼 있었다.
- **고친 코드**
    ```diff
    -"�?록�?는 메시지�??�습?�다."            +"기록에 없는 메시지입니다."   (share, unshare)
    -"공유�??�용?� 메시지�? 아�???�니??"      +"공유된 대화가 아니거나 공유가 해제되었습니다."
    -"?�용?��? 존재?��? ?�습?�다."            +"사용자 정보를 찾을 수 없습니다."
    ```
  파일은 UTF-8(BOM 없음), LF 그대로.
- **확인**: 컴파일 성공, `grep` 으로 문구 확인.
- **남은 것**: 없음.

### 22. (문서) 운영 DB 는 Postgres + `ddl-auto=update`

- **현황**: `application-prod.properties` 가 Postgres(`jdbc:postgresql://…`) + `spring.jpa.hibernate.ddl-auto=update`. 로컬/테스트는 MySQL. CLAUDE.md 에는 MySQL 로만 적혀 있다(다른 사람이 고칠 예정). 운영 설정은 바꾸지 않았다.
- **위험**: `update` 는 칼럼·인덱스 추가만 하고 이름 변경·타입 변경·삭제·데이터 보정은 못 한다. 실패해도 조용히 넘어가거나 기동이 멈출 수 있고, 무엇이 언제 바뀌었는지 기록이 남지 않는다. 이번 변경(새 테이블 `attendance_share_reports`, 인덱스 `idx_attendance_date_user`)도 `update` 에 기대고 있다.
- **권장 Flyway 도입 계획**
  1. 의존성 `org.flywaydb:flyway-core` + `flyway-database-postgresql` 추가(로컬 MySQL 도 쓰면 `flyway-mysql`).
  2. **기준선**: 운영 DB 스키마를 `pg_dump --schema-only` 로 떠서 `db/migration/V1__baseline.sql` 로 저장. `spring.flyway.baseline-on-migrate=true`, `baseline-version=1` 로 기존 DB 를 V1 로 표시(기존 데이터 그대로).
  3. 이번 변경을 `V2__attendance_share_reports_and_date_index.sql` 로 명시(배포 전에 이미 `update` 가 만들었다면 `IF NOT EXISTS` 로 작성):
     ```sql
     CREATE TABLE IF NOT EXISTS attendance_share_reports (
       id BIGSERIAL PRIMARY KEY,
       attendance_log_id BIGINT NOT NULL REFERENCES attendance_logs(id),
       user_id BIGINT NOT NULL REFERENCES users(id),
       created_at TIMESTAMP, updated_at TIMESTAMP,
       CONSTRAINT uk_attendance_share_report_log_user UNIQUE (attendance_log_id, user_id)
     );
     CREATE INDEX IF NOT EXISTS idx_attendance_date_user ON attendance_logs (workout_date, user_id);
     ```
     (운영 데이터가 많아지면 `CREATE INDEX CONCURRENTLY` 를 별도 마이그레이션으로.)
  4. 한 번 배포해 Flyway 가 정상 적용되는 것을 본 뒤 `ddl-auto=validate` 로 내린다. 이후 스키마 변경은 반드시 `V{n}__*.sql` 로.
  5. 로컬은 Postgres(도커)로 맞추는 것을 권장. MySQL 을 계속 쓰면 SQL 방언 차이 때문에 `db/migration/{vendor}` 로 나눠야 한다.
  6. 시간대(11번) 보정 SQL 이 필요하면 이 단계에서 `V3__shift_timestamps_to_kst.sql` 로 기록을 남기며 실행.

---

## 확인한 방법

- `backend\gradlew.bat -p backend compileJava compileTestJava` → BUILD SUCCESSFUL.
- 기존 테스트 중 출석·모임을 다루는 것은 없다(`BackendApplicationTests.contextLoads` 는 DB 필요, `AiInbodyQualityHarnessTest` 는 무관).
- 다른 에이전트가 쓰는 8080 을 건드리지 않고 **8097 에 별도 백엔드**를 `local` 프로필로 띄워 확인(확인 후 종료):
  - 기동 성공 = 새 JPQL(`findWorkoutDaysWithNicknameBetween`, `findDateFlagsByUserIdAndDateRange`, `increment*Count`, `findAllWithOwner`, `countMembersGroupByCrewId`, `findCrewIdsByUserId`, 3대 랭킹 countQuery) 문법 검증 통과.
  - 로컬 MySQL: `attendance_share_reports` 테이블, `idx_attendance_date_user` 인덱스 생성 확인.
  - 공개 공유 조회 응답 필드, 응원 중복 방지(1→1), 비로그인 신고 401, OG 설명에 메모 없음, 없는 slug 404 확인.
  - 시험 응원으로 올라간 로컬 DB `attendance_logs.id=17` `cheer_count` 는 0 으로 되돌렸다.

## 확인 못 한 것

- 로그인이 필요한 경로(출석 저장 PUT 의 날짜 제한 400/404, 동시 출석 재시도, 주간 랭킹 응답, 모임 목록·상세의 초대코드/비멤버 응답, `/api/character/me` 경험치 필드, 로그인 신고 1인 1회)는 브라우저 미리보기에 로그인 세션이 없어 실제 호출하지 못했다. 코드 경로와 컴파일·기동만 확인했다.
- 화면(데스크톱/모바일)은 프론트 담당이라 보지 않았다. 위 "남은 것 (프론트)" 항목이 반영돼야 공유 화면의 "신고 undefined"·"메모 없음" 표시가 정리된다.
