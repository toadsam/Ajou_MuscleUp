# 2026-10-11 · 로그인 없이 지도 체험 (로드맵 7-1)

목표: 처음 온 사람이 로그인 전에 "우와" 하는 순간을 겪게 한다. 캐릭터를 만들고 → 지도를 걸어 다니고 →
출석 체크기에서 원판이 꽂히는 연출을 한 번 직접 보고 → 그 캐릭터 그대로 가입하게.

## 1. 체험 캐릭터 저장 — 새 파일

- `frontend/src/components/gymMap/guestCharacter.ts`
  - `GuestCharacter = { gender: "MALE" | "FEMALE"; mbti: string }`
  - `loadGuestCharacter()` / `saveGuestCharacter()` / `clearGuestCharacter()` — localStorage 키 `dg.guestCharacter`.
    모든 읽기·쓰기를 try/catch 로 감싸 저장소가 막힌 환경에서도 화면은 그대로 동작한다.
    읽을 때 성별 · MBTI 형식(`^[EI][NS][TF][JP]$`)을 검사해 이상한 값은 버린다.
  - 서버로 보내지 않는다. 가입 전에는 이 기기에만 남는다(화면에도 그렇게 안내).

## 2. 지도에 체험 흐름 — `frontend/src/components/gymMap/GymMap.tsx`

- 상태 추가: `guest`(저장된 체험 캐릭터), `draft`(만드는 중인 값, 처음 MBTI 는 무작위), `builderOpen`, `trialDone`.
- 로그인 전에는 지도에 넘기는 값을 체험용으로 바꾼다.
  ```diff
  - const { loggedIn, weekDays, streak, checkedToday, loungeCount, mbti, celebrate } = props;
  + const weekDays = isGuest ? (trialDone ? 1 : 0) : props.weekDays;
  + const checkedToday = isGuest ? trialDone : props.checkedToday;
  + const mbti = isGuest ? (building ? draft.mbti : guest?.mbti) : props.mbti;
  ```
  만드는 동안 고른 MBTI 가 지도 속 "나" 캐릭터 색에 바로 반영된다.
- **캐릭터 만들기 창**(`.gm-guest`, 지도 아래쪽 시트 모양): 미리보기 아바타(`AvatarRenderer`, BRONZE · STAGE 1) +
  성별 2칸 + MBTI 네 쌍(E/I · N/S · T/F · J/P) 토글 + "이걸로 둘러보기" / "건너뛰기".
  체험 캐릭터가 없을 때만 처음에 열린다. 만들 때는 이 창이 열려 있는 동안 다른 시트와 "바닥을 눌러 걸어보세요" 힌트를 숨긴다.
- `createGuest()`: 저장 → 관장님이 "체크기에서 출석 체험 해 봐요" → 캐릭터가 체크기로 걸어가 체험 시트가 열린다.
- **출석 체험**(체크기 시트의 "원판 꽂아 보기", `tryCheckin`): 엔진에 `setState({ plates: 1, checked: true })` 후
  `celebrate()` → 원판이 날아가 바벨에 꽂히고 화면이 흔들린다. 기록은 남지 않고 새로고침하면 0 으로 돌아간다.
  착지하면 `onPlateLanded` 가 로그인 전이면 "체험 출석 완료 · +1 원판" 을 띄우고 0.7초 뒤 가입 안내 시트를 다시 연다.
- 시트 내용(로그인 전)
  - 체크기: 체험 전 "출석 체험 해 보기"(가입 버튼은 보조 색 `quiet`), 체험 후 "이렇게 원판이 쌓여요 · 지금 만든 캐릭터 그대로 시작해요".
  - 거울: 체험 캐릭터 크게 + BRONZE · LV 1 + "다시 만들기".
  - 가입 버튼 문구 "Google로 시작하기".
- HUD 레벨 `–` → 체험 캐릭터가 있으면 `1`. 아래 바로 가기 첫 버튼 "출석 체험" / "체험 완료".
- 직원 대사: 로그인 전 관장님은 "캐릭터부터 만들어 볼까요?" → "체크기에서 출석 체험" → "가입하면 매일 이렇게 쌓여요" 순서. 코치는 가끔 "가입하면 그대로 이어져요".
- 측정: `guest_create`(mbti·성별), `guest_skip`, `guest_trial_checkin`, `guest_signup_click`(어느 시트에서 눌렀는지) 이벤트.
- `Sheet` 타입에 `quiet?: boolean` 추가 — 시트 본문에 주 버튼이 따로 있을 때 아래 링크를 보조 색으로.
- `tryCheckin` 을 `useCallback([trialDone])` 으로 감싸 시트 `useMemo` 의존성에 넣었다(린트 경고 0 유지).

스타일: `frontend/src/components/gymMap/gymMap.css` 에 `.gm-guest*` `.gm-seg*` `.gm-trial` `.gm-textbtn` 추가(짐 플로어 색, 블러·그라데이션 없음).

## 3. 가입 뒤 이어받기 — `frontend/src/pages/MyPage.tsx`

- 스탯이 아직 없는 사람(`/api/mypage/stats` 가 비어 있음)이 마이페이지에 오면, 체험 캐릭터의 성별 · MBTI 로 입력칸을 채우고
  "체험 때 만든 캐릭터를 불러왔어요. 키·몸무게만 넣으면 완성!" 안내를 띄운다.
  ```diff
  - setForm(emptyForm);
  + const guest = loadGuestCharacter();
  + setForm(guest ? { ...emptyForm, gender: guest.gender, mbti: guest.mbti } : emptyForm);
  ```
- 스탯 저장에 성공하면 `clearGuestCharacter()`.
- 서버에 바로 저장하지 않는 이유: `PUT /api/mypage/stats` 는 몸무게가 필수(`UserBodyStatsRequest.weightKg @NotNull`)라 성별 · MBTI 만으로는 저장할 수 없다.

## 4. 함께 고친 버그 — S 계열 MBTI 캐릭터 색

- **문제**: ISTJ · ESFJ · ESTP · ISFP 같은 S 계열은 정해진 초록/빨강 대신 기본색(회색 민소매)으로 나왔다.
- **원인**: `AvatarRenderer.tsx` `mbtiTone` 과 `engine.ts` `toneForMbti` 가 `v.includes("SJ")` · `includes("SP")` 로 찾는데,
  실제 MBTI 4글자에서 S 와 J/P 는 붙어 있지 않다("ISTJ" 에 "SJ" 없음). NT · NF 만 우연히 맞았다.
- **고친 코드**: 새 `frontend/src/components/avatar/mbti.ts` `temperament(mbti)` — 2번째 글자가 N 이면 3번째(T/F), S 면 4번째(J/P)로 기질을 정한다. 두 파일 모두
  ```diff
  - if (v.includes("SJ")) return …
  + if (temperament(v) === "SJ") return …
  ```
- **영향**: 기존 S 계열 회원은 캐릭터 민소매 색이 회색 → 초록(SJ) · 빨강(SP)으로 바뀐다(원래 설계대로).

## 확인

- `bash scripts/verify.sh` 의 타입 검사(`tsc -b --force`) · 빌드 통과. 바뀐 파일 린트는 바뀌기 전보다 늘지 않음(GymMap 0, MyPage 9 → 9).
- 브라우저(로그아웃, 375px · 데스크톱)
  - 첫 진입 → 만들기 창이 뜨고, 성별 · MBTI 를 누르면 미리보기가 바뀜. ESTP 를 고르면 빨간 민소매(S 계열 버그 수정 확인).
  - "둘러보기" → LV 1, 캐릭터가 체크기로 걸어가 "출석 체험 해 보기" 시트가 열림.
  - "원판 꽂아 보기" → HUD 0/7 → 1/7, "체험 출석 완료 · +1 원판", 가입 안내 시트 다시 열림, 바로 가기 "체험 완료".
  - 새로고침 → 만들기 창 없이 LV 1 유지, 거울 시트에 체험 캐릭터 · "다시 만들기" → 저장된 값이 선택된 채 창이 열림.

## 못 한 것

- 로그인 뒤 마이페이지 이어받기(입력칸 채움 · 저장 후 삭제)는 Google 로그인이 필요해 화면으로 확인하지 못했다(타입 검사만).
- 미리보기 창이 화면 뒤에 있을 때 그리기가 느려져, 만든 직후 걸어가는 데 오래 걸린 적이 있다. 실제 휴대폰에서 체감 속도 확인 필요.
