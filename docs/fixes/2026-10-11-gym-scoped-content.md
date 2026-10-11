# 2026-10-11 · 0단계 PR 6-2 — 헤더 모임 고르기 · 소식 / 출석 이벤트 / 프로그램 신청 / 자랑방을 모임별로

설계: [../design/stage0-gyms.md](../design/stage0-gyms.md) §2 "무엇을 짐별로 나누나" · §4-4 · §7 "헤더에 짐 전환".

## 0. 규칙 한눈에

| 화면 | 광장(모임 안 고름) | 모임을 고르면 | 닫힌 모임(비공개 · 승인 전) |
|---|---|---|---|
| 소식(`cms_events`) | 앱 전체 공지 + 공개 · 운영 중 모임 소식 | 그 모임 소식 + 앱 전체 공지 | 멤버 · 앱 운영자만, 그 밖엔 404 |
| 출석 이벤트(`events`) | 앱 전체 + 공개 모임 + 내 모임 | 그 모임 + 앱 전체 | 위와 같음. **출석 횟수는 내가 멤버인 모임 이벤트에만 쌓인다** |
| 자랑방(`brag_post`) | 전체 공개 + 친구의 친구 공개 + 내 글 | 그 모임에 올린 글(멤버는 "우리 모임만" 글도) | 피드 404 |
| 프로그램 신청 | 앱 전체 | 그 모임 앞으로 | 볼 수 없는 모임이면 앱 전체로 받음(신청이 실패하지 않게) |

공개 범위에 **"우리 모임만"(GYM)** 이 생겼다. 그 모임 멤버 · 작성자 · 앱 운영자만 본다(댓글 · 좋아요도 같은 규칙).

## 1. 판단을 한 곳으로 — `GymScope` (새)
`backend/.../service/GymScope.java`
- `isOpen` (운영 중 + 비공개 아님) · `isMember` · `canSee(gym, viewer)` · `visibleOrThrow(slug, viewer, inviteCode)` · `postableOrThrow(slug, user)` · `myGymIdsForQuery` · `findUser`(비로그인 `anonymousUser` 처리).
- `GymService.visibleGymOrThrow` 는 이제 `gymScope.visibleOrThrow` 를 부른다(같은 규칙 한 벌).

## 2. 데이터
- 엔티티에 `gym`(ManyToOne, `gym_id`, null 허용): `CmsEvent` · `Event` · `ProgramApplication` · `BragPost`.
- `BragVisibility` 에 `GYM`.
- `db/migration/{postgresql|mysql}/V4__gym_scoped_content.sql`
  1. 자랑방 공개 범위 제약 풀기 — Postgres: `brag_post` 의 visibility CHECK 제약 지우기, MySQL: `MODIFY visibility VARCHAR(16)`.
  2. 예전 소식 · 출석 이벤트 · 프로그램 신청 → 아주대 짐(`ajou-muscleup`). 자랑방 글은 광장 그대로(지금처럼 모두에게 보임).

## 3. API

| API | 바뀐 것 |
|---|---|
| `GET /api/events?gym=` | 위 규칙. `CmsEventRepository.findPublicSquare` · `findPublicInGym`(q 는 빈 문자열 — Postgres bytea 함정) |
| `GET /api/events/{id}` | 닫힌 모임 소식은 멤버만(404) |
| `POST/PUT /api/admin/events` | `gymSlug`(비우면 앱 전체 공지). 응답 · 목록에 `gymSlug` · `gymName` |
| `GET /api/events/active?gym=` | 위 규칙. 응답에 `gymSlug` · `gymName` |
| 출석 → 이벤트 진행 (`EventServiceImpl.updateAttendanceProgress`) | 앱 전체 + **내가 멤버인 모임** 이벤트만 자동 참가 · 집계 |
| `POST /api/programs/apply` | `gymSlug`(선택). 볼 수 없는 모임이면 앱 전체로 저장. 관리자 목록에 `gymName` |
| `GET /api/brags?gym=` | `BragPostRepository.findSquareFeed` · `findGymFeed` |
| `POST /api/brags` | `gymSlug` · `visibility`. 모임에 올리려면 운영 중 모임 멤버(403), 닫힌 모임이면 404, GYM 인데 모임 없음 400 |
| `PUT /api/brags/{id}` | **보내지 않은 공개 범위 · 모임은 원래 값 유지**(빈 문자열 `gymSlug` = 광장으로). 같은 모임이면 다시 확인 안 함 |
| 자랑방 상세 · 댓글 · 좋아요 | `BragAccess.requireView` 한 곳에서(예전엔 두 서비스에 같은 코드가 따로 있었다) |

```diff
- Page<BragPost> findByVisibilityOrUser_IdInOrderByCreatedAtDesc(PUBLIC, friends + me)
+ where visibility = PUBLIC or (visibility = FRIENDS and user in friends) or user = me
```
예전 쿼리는 "친구 글이면 공개 범위와 상관없이" 보여 줬다. GYM 이 생기면 친구의 모임 전용 글이 광장에 새므로 FRIENDS 로 좁혔다.

### 같이 고친 버그
- `BragPostServiceImpl` 생성 · 수정에서 사진이 없으면 `List.of()`(바꿀 수 없는 목록)을 넣었다 → 수정 저장 때 Hibernate 가 목록을 비우려다 `UnsupportedOperationException` → 500. `new ArrayList<>()` 로. 화면은 항상 배열을 보내서 지금까진 드러나지 않았다(새 테스트에서 발견).

## 4. 화면 (에이전트 작성 → 검토)
- `lib/currentGym.ts`(새): `dg.currentGym`(slug) · `useCurrentGym` · `useMyGyms`(`/api/gyms/mine`, react-query).
- `layouts/Header.tsx`: 내 모임이 있으면 "지금 보는 곳" 고르기(광장 (전체) · 내 모임 · 모임 찾기). 데스크톱은 로그아웃 옆, 모바일은 메뉴 맨 위. **로그아웃하면 광장으로 되돌린다**(검토 때 추가 — 다음 사람이 이전 계정의 모임을 보고 있지 않게).
- `Events.tsx` · `EventDetail.tsx` · `Home.tsx`: `gym` 으로 받기, "광장 소식" / "○○ 소식", 모임 이름 칩.
- `admin/AdminEventForm.tsx` · `AdminEventsList.tsx`: "어느 모임 소식인가요" · 모임 열.
- `BragList.tsx` · `BragWrite.tsx` · `BragDetail.tsx`: 모임 피드, "올릴 곳"(모임 / 광장에만), "우리 모임만", 수정 때 공개 범위 · 모임 유지.
- `Programs.tsx`: 신청에 `gymSlug`.
- `lib/httpError.ts`: axios 오류의 서버 한국어 문구 읽기, `errorStatus`.

## 5. 확인
- 새 테스트 `GymScopedContentTest` 4개: 소식 나누기(광장 · 공개 모임 · 비공개 모임 404 · 상세), 출석 이벤트는 멤버만 집계, "우리 모임만" 글이 밖에 안 보임(목록 · 상세 · 댓글 · 남의 모임에 올리기 · 수정 때 유지), 모임에 올린 공개 글은 광장에도.
- 백엔드 테스트 33개 통과: 로컬 MySQL + 임시 Postgres 17(예전 데이터를 넣고 V4 적용 → 제약 0개, 예전 소식 · 이벤트 = 아주대 짐).
- `verify.sh` 통과(타입 0 · 바꾼 파일 린트 늘어난 것 없음 · 빌드).
- 화면: 로그아웃 상태 `/events` 광장 / 아주대 짐(375px, 가로 넘침 없음).

**못 한 것**: 로그인해야 보이는 헤더 모임 고르기 · 모임 자랑방 쓰기 · 관리자 소식 모임 고르기는 화면으로 못 봤다(API 는 테스트로 확인).

## 6. 남은 것
- 모임 운영진(STAFF)이 자기 모임 소식을 직접 올리는 화면(지금은 앱 운영자만 `/admin` 에서) — `GymAction.MANAGE_CONTENT` 로 열 예정.
- 홈 지도를 고른 모임 기준으로(설계 §7) — PR 7(라운지 방) 과 함께.
