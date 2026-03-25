# InBody Quality Playbook

## 목적
- `/ai/inbody` 결과를 프롬프트 감이 아니라 실제 케이스 기준으로 고도화한다.
- 배포 전후에 같은 샘플 케이스로 결과를 비교해 품질 하락을 빠르게 찾는다.

## 테스트 세트 위치
- 샘플 케이스: [backend/src/test/resources/inbody/sample-cases.json](/c:/Users/user/OneDrive/문서/GitHub/Whims-of-Wonder/Ajou_MuscleUp/backend/src/test/resources/inbody/sample-cases.json)

## 최소 점검 케이스
- 마른 비만형 초보 남성
- 체지방 과다형 초보 여성
- 근육 부족형 여성
- 벌크업 준비형 남성
- 체지방 과다 남성
- 저체중 경향 남성
- 30대 후반 재구성형
- 수치 누락 케이스

## 평가 기준
- `총평 선명도`: 한 줄 결론이 명확한가.
- `진단 정확성`: 현재 몸 타입을 엉뚱하게 분류하지 않는가.
- `우선순위 설득력`: 1순위, 2순위, 3순위가 납득되는가.
- `운동 현실성`: 초보자도 실제로 실행 가능한가.
- `식단 현실성`: 지나치게 극단적이지 않은가.
- `생활습관 연결성`: 수면, 회복, 활동량까지 연결되는가.
- `위험 신호 품질`: 불안만 주지 않고 실제 경고로 기능하는가.
- `오해 교정력`: 체중만 보는 해석 같은 초보자 오해를 잘 바로잡는가.
- `금지사항 명확성`: 하지 말아야 할 행동이 분명한가.
- `유료 가치`: 돈 내고 본다고 해도 밀도와 구체성이 충분한가.

## 점수 예시
- 5점: 그대로 배포해도 될 정도로 설득력 있음
- 4점: 대체로 좋지만 표현이나 우선순위 미세 조정 필요
- 3점: 방향은 맞지만 디테일이 약함
- 2점: 초보자에게 혼란을 줄 수 있음
- 1점: 방향이 틀렸거나 실전 가치가 거의 없음

## 실제 작업 순서
1. 샘플 케이스 하나를 선택한다.
2. 현재 프롬프트와 로직으로 결과를 생성한다.
3. `총평`, `진단`, `우선순위`, `운동`, `식단`, `생활`, `위험 신호`, `오해`, `금지사항`을 읽는다.
4. 위 평가 기준으로 1~5점씩 매긴다.
5. 가장 낮은 점수를 받은 항목이 프롬프트 문제인지, 규칙 문제인지 구분한다.

## 자동 평가 루프 실행
- 하네스 위치: [AiInbodyQualityHarnessTest.java](/c:/Users/user/OneDrive/문서/GitHub/Whims-of-Wonder/Ajou_MuscleUp/backend/src/test/java/com/ajou/muscleup/ai/AiInbodyQualityHarnessTest.java)
- 실행 전제: `OPENAI_API_KEY`가 설정되어 있어야 한다.
- 실행 명령:
```bash
cd backend
./gradlew.bat test --tests com.ajou.muscleup.ai.AiInbodyQualityHarnessTest
```
- 결과 파일:
  - `backend/build/reports/inbody-quality/latest-report.md`
  - `backend/build/reports/inbody-quality/latest-report.json`
- 자동 점수는 참고용이다. `diagnosisFit`, `priorityFit`, `safety`가 3점 이하인 케이스는 사람이 반드시 다시 읽고 보정한다.

## 프롬프트 수정이 맞는 경우
- 말투가 너무 두루뭉술함
- 근거 설명이 약함
- 오해 교정 문장이 부족함
- 지나치게 친절하거나 지나치게 공격적임

## 규칙 보정이 맞는 경우
- 특정 체성분 조합에서 우선순위가 자꾸 뒤틀림
- 체지방이 높은데 감량보다 벌크업 쪽으로 설명함
- 수치 누락인데도 확정적으로 말함
- 위험 신호가 필요한 케이스에서 경고 강도가 너무 약함

## 추천 보정 전략
- 프롬프트는 문체와 설명 깊이를 담당하게 둔다.
- 우선순위와 경고 강도는 백엔드 규칙으로 보정한다.
- 프론트는 `우선순위`, `위험 신호`, `오해 정정`, `금지사항`을 시각적으로 더 세게 보여준다.

## 다음 후보 작업
- 샘플 케이스별 기대 출력 키워드 자동 비교 스크립트 추가
- 케이스별 점수표를 저장하는 회귀 테스트 문서 추가
- 실제 인바디 캡처 이미지 기반 OCR 품질 테스트 세트 분리
