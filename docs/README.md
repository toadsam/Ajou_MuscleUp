# 득근득근 문서 안내

이 폴더는 득근득근 프로젝트의 발표/제출용 서비스 소개 문서, 실제 사용자용 사용 설명서, 화면 캡처 이미지, 캡처 검증 보고서를 모아 둔 문서 패키지입니다.

## 문서 구성

| 파일 | 설명 |
|---|---|
| `service-introduction.md` | 득근득근의 서비스 목적, 주요 기능, 사용자별 가치, 시스템 구성, 기대 효과를 정리한 발표/제출용 소개 문서입니다. |
| `user-guide.md` | 실제 사용자가 화면을 따라가며 기능을 사용할 수 있도록 작성한 사용 설명서입니다. |
| `service-introduction.html` | `service-introduction.md`를 제출용 HTML 형식으로 변환한 문서입니다. 목차, 표, 이미지 캡션, 인쇄용 스타일이 포함됩니다. |
| `user-guide.html` | `user-guide.md`를 제출용 HTML 형식으로 변환한 문서입니다. |
| `service-introduction.pdf` | 서비스 소개 HTML을 PDF로 출력한 파일입니다. |
| `user-guide.pdf` | 사용 설명서 HTML을 PDF로 출력한 파일입니다. |
| `images/` | 실제 실행 화면을 Playwright로 캡처한 PNG 이미지가 저장된 폴더입니다. |
| `scripts/` | 화면 캡처와 HTML/PDF 생성을 재실행할 수 있는 문서 생성 보조 스크립트가 저장된 폴더입니다. |
| `capture-report.md` | 실행 환경, 캡처 도구, 접근 URL, 캡처 화면, 제외한 기능, 민감정보 검토 결과를 기록한 보고서입니다. |

## 문서를 여는 방법

Markdown 문서는 GitHub, VS Code, IntelliJ, 일반 Markdown 뷰어에서 열 수 있습니다.

HTML 문서는 브라우저에서 바로 열람할 수 있습니다.

1. 파일 탐색기에서 `docs/service-introduction.html` 또는 `docs/user-guide.html`을 엽니다.
2. 기본 브라우저가 실행되면 목차와 이미지가 정상적으로 표시되는지 확인합니다.
3. 인쇄 또는 PDF 저장이 필요한 경우 브라우저의 인쇄 기능을 사용합니다.

## HTML을 PDF로 저장하는 방법

이미 생성된 PDF를 그대로 제출할 수 있습니다. 브라우저에서 다시 저장하려면 다음 순서로 진행합니다.

1. `service-introduction.html` 또는 `user-guide.html`을 브라우저에서 엽니다.
2. `Ctrl + P`를 누릅니다.
3. 프린터 대상을 `PDF로 저장`으로 선택합니다.
4. 용지 방향은 기본 세로 방향을 사용합니다.
5. 배경 그래픽 옵션을 켜면 표 머리글과 코드 블록 배경이 더 정확하게 출력됩니다.

## 제출 시 추천 파일

기본 제출 파일:

- `docs/service-introduction.pdf`
- `docs/user-guide.pdf`
- `docs/capture-report.md`

보조 제출 또는 검토 파일:

- `docs/service-introduction.html`
- `docs/user-guide.html`
- `docs/images/`

Markdown 원본은 발표 자료 작성, 문구 수정, GitHub 제출용으로 활용할 수 있습니다.
