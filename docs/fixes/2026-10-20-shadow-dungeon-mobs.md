# 2026-10-20 · 그림자 던전 지도판 D1 — 백엔드 잡몹(배치 · target strike · 남은 힘 반환 · 조각 · 타이밍 5 · 2%)

설계: [docs/design/shadow-dungeon-map.md](../design/shadow-dungeon-map.md) 3 · 4 · 6절. PR #54 위에 더했다(#54 는 D2 맵까지 붙인 뒤 머지).

## 1. 데이터

| 파일 | 바뀐 것 |
|---|---|
| `entity/ShadowMob.java` (새) | 표 `shadow_mobs`: week · user · `code`(문자열) · `slot` · `hp` · `damage` · `killed_at`. 인덱스 week_id · (user_id, code) |
| `entity/ShadowWeek.java` | `mob_force`(`@ColumnDefault("0")`) — 잡몹에 쓴 힘(보너스 전) |
| `entity/ShadowHit.java` | 상수 `MOB`(응답에만, 이 표엔 안 넣음 — 잡몹 피해는 보스 합계와 섞지 않는다) |
| `repository/ShadowMobRepository.java` (새) | 주별 목록(자리 순) · 내 것 찾기 · 종류별 처치 수(첫 처치) · 누적 처치 수(D3 꾸미기용) |

## 2. 규칙 (`ShadowRules`)

```
TIMING_PERFECT_PCT 10 → 5, TIMING_GOOD_PCT 5 → 2      (사용자: 조작 영향 "거의 없게")
MobDef(code, name, hpPct, shards, rare)
  TOMORROW 내일부터 10% 1 · MIDNIGHT_SNACK 야식 슬라임 12% 1 · SNOOZE 알람 스누즈 10% 1 · EXCUSE 핑계 14% 2 · SOFA 소파 괴물 20% 5 (희귀)
mobHp(bossHp, def) = max(15, round(bossHp × hpPct / 100))
mobLineup(userId, weekStart, rare)  4종을 Random(userId × 1000003 + epochDay) 로 섞어 자리 0~3, 희귀면 SOFA 자리 4
RARE_OVERKILL_PCT 50   지난주 보스를 50% 이상 오버킬로 잡았으면 희귀
neededForce(force, remaining, bonusPct, crit, mult)  피해가 남은 체력 이상이 되는 최소 힘(1..force), 모자라면 force
```

## 3. 서비스 (`ShadowBossService`)

- `currentWeek` 끝에 `ensureMobs`: 이번 주 잡몹이 없으면 만든다(새 주 · 배포 전에 생긴 이번 주 행 모두). 지난주 행으로 희귀 여부.
- 새 주 체력: 최근 4주의 `damage + mob_force` 평균 × 1.05 — 잡몹에 쓴 힘도 "그 주에 한 운동량"이라.
- `strike(user, target, skill, grade, crit)`: target 이 비었거나 `BOSS` 면 보스(이전과 같음). 숫자면 `mobTarget` — 내 것 아니거나 없으면 404, 지난주 것 · 이미 쓰러짐 400, 이상한 값 400. **상대 확인이 통 확인보다 먼저**(모르는 몬스터에 "힘이 없어요"가 뜨지 않게).
- `strikeMob`: 통에서 min(통, 60) 을 꺼내 보너스 · 치명타를 넣고 `neededForce` 만큼만 쓰고 나머지는 통에 남긴다(오버킬 없음). `mob_force += used`, 잡몹 `damage += min(남은 체력, 피해)`. 쓰러지면 `killed_at` · 조각(`CollectionService.grantShards`) · 종류별 첫 처치 여부. 치명타 토큰은 켰으면 쓴다.
- 응답 `ShadowHitResponse`: source `MOB`, hp · hpBefore · hpAfter · killed 가 잡몹 것, `mob { id, code, name, rare, refunded, shards, firstKill }`. 보스 타는 `mob: null`.
- `status` · `enter` 응답에 `mobs: [{ id, code, name, slot, hp, remaining, killed, rare, shards }]`.
- 세션 삭제: 이미 쓴 힘은 지금처럼 보스 타에서만 깎는다(잡몹 처치 · 조각은 되돌리지 않음 — 보스 처치와 같은 원칙).
- 휴식 주에도 잡몹은 잡을 수 있다(보스만 잠듦).

## 4. 그 밖

- `CollectionService.grantShards(me, n)`(지갑 잠금 후 더함).
- `AccountDeletionService`: `ShadowMob` 삭제(ShadowCharge 앞). `AccountSafetyTest` 에 행 + 0 확인.
- `ShadowController` strike 몸 `{target, skill, grade, crit}`, `ShadowStrikeRequest` 에 `target`.
- 프론트 타입만(`lib/shadow.ts`): `ShadowSource` 에 `MOB`, `ShadowHit.mob` · `ShadowMobHit` · `ShadowMob` · `ShadowStatus.mobs`, `TIMING_PCT` 5 · 2, `/shadow` 규칙 문구 "최대 5%". 화면은 D2.

## 5. 확인

- `ShadowBossServiceTest` 24개(새 6: 배치 4마리 · 체력 비율 · 시드 고정 · 최소 15 / 희귀 소파 · 50% 경계 / 남은 힘 반환 42 · 18, PERFECT 48 로 50 / 부족하면 깎이기만 / 대상 확인 404 · 400 · 첫 처치 종류별 · 지난주 잡몹 / 잡몹 힘이 다음 주 체력에 / API enter · target · BOSS), 기존 타이밍 기대값 5 · 2% 로. 백엔드 전체 **113개 통과**(local).
- `verify.sh` 통과(tsc · 린트 · 빌드).
- 8081 실제 호출(시험 계정): `shadow_mobs` 칸 · `mob_force` 기본값 0 → 운동 저장(하체 80) → enter 잡몹 4마리(첫 주 15) → 잡몹 PERFECT: 14 만 쓰고 15 피해 · 처치 · 46 반환 · 조각 1 · 첫 처치 → 같은 몹 400 → BOSS GOOD 61 → 상태: 보스 피해 61 · 공격 1 · 잡몹 처치 1 · DB mob_force 14 · 조각 1 · 이메일 없음 → 탈퇴 뒤 행 0.

## 6. 아직 못 한 것

- D2 맵 · 조이스틱 · 잡몹 그림 · 전투 창, D3 꾸미기 보상(누적 처치 물품 · 테두리 · 도감 몬스터 카드 화면).
- Postgres 17 에서 `shadow_mobs` · `mob_force` 추가 미확인(#54 와 같이 배포 전 확인).
