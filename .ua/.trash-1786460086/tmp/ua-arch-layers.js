'use strict';
const fs = require('fs');
const path = require('path');

const root = process.argv[2];
const results = JSON.parse(fs.readFileSync(path.join(root, '.ua/tmp/ua-arch-results.json'), 'utf8'));
const input = JSON.parse(fs.readFileSync(path.join(root, '.ua/intermediate/arch-input.json'), 'utf8'));

const G = results.directoryGroups;
const byId = new Map(input.fileNodes.map(n => [n.id, n]));
const fp = id => String(byId.get(id).filePath).replace(/\\/g, '/');
const base = id => fp(id).split('/').pop();

const g = name => (G[name] || []).slice();

// --- split the mixed root groups ---
const feRoot = g('frontend/(root)');
const FE_UI_ROOT = new Set(['App.tsx', 'main.tsx', 'index.html', 'App.css', 'index.css']);
const FE_DATA_ROOT = new Set(['vite-env.d.ts']);
const FE_DOC_ROOT = new Set(['README.md']);

const feUiRoot = feRoot.filter(id => FE_UI_ROOT.has(base(id)));
const feDataRoot = feRoot.filter(id => FE_DATA_ROOT.has(base(id)));
const feDocRoot = feRoot.filter(id => FE_DOC_ROOT.has(base(id)));
const feBuildRoot = feRoot.filter(id => !FE_UI_ROOT.has(base(id)) && !FE_DATA_ROOT.has(base(id)) && !FE_DOC_ROOT.has(base(id)));

const beRoot = g('backend/(root)');
const BE_ENTRY = new Set(['BackendApplication.java', 'MuscleupApplication.java']);
const beEntry = beRoot.filter(id => BE_ENTRY.has(base(id)));
const beBuildRoot = beRoot.filter(id => !BE_ENTRY.has(base(id)));

const layers = [
  {
    id: 'layer:backend-api',
    name: '백엔드 API 레이어',
    description: 'Spring REST 컨트롤러가 /api 하위의 인증·출석·캐릭터·랭킹·모임·AI·관리자 엔드포인트를 노출하고, GlobalExceptionHandler가 예외를 공통 오류 응답으로 변환한다. 요청을 DTO로 받아 서비스 레이어에 위임하는 시스템의 HTTP 진입 지점이다.',
    nodeIds: [...g('backend/controller'), ...g('backend/exception')],
  },
  {
    id: 'layer:backend-service',
    name: '백엔드 서비스 레이어',
    description: '출석 체크, 캐릭터 성장·재평가, 랭킹 집계, 모임 운영, AI 인바디 분석 등 핵심 비즈니스 로직을 담당하는 서비스와 *ServiceImpl 구현체, 그리고 KST 기준 일일 배치를 도는 EventScheduler로 구성된다. repository·entity·dto를 모두 소비하는 가장 의존도가 높은 레이어다.',
    nodeIds: [...g('backend/service'), ...g('backend/scheduler')],
  },
  {
    id: 'layer:backend-dto',
    name: '백엔드 DTO 계약 레이어',
    description: '도메인별 하위 패키지로 나뉜 요청·응답 DTO 모음으로, 컨트롤러와 서비스가 공유하는 API 계약을 정의한다. entity를 참조해 도메인 모델을 외부 노출용 형태로 변환하며 백엔드 파일의 약 4분의 1을 차지한다.',
    nodeIds: [...g('backend/dto')],
  },
  {
    id: 'layer:backend-data',
    name: '백엔드 데이터 레이어',
    description: 'JPA entity로 표현된 도메인 모델, Spring Data JPA repository, 그리고 backend/sql의 날짜별 마이그레이션 스크립트에서 추출한 실제 DB 테이블 정의를 함께 묶는다. 테이블은 migrates 관계로 대응 entity와 연결되어 스키마와 코드의 대응 관계를 보여준다.',
    nodeIds: [...g('backend/entity'), ...g('backend/repository'), ...g('backend/sql')],
  },
  {
    id: 'layer:backend-platform',
    name: '백엔드 플랫폼·보안 설정',
    description: 'Spring Security 필터 체인, JWT 인증 필터와 JwtUtil, CORS·비동기·스케줄링·JPA auditing 설정, 관리자 부트스트랩 및 Postgres 스키마 보정 러너, 프로필별 application.properties, 정적으로 서빙되는 업로드 미디어를 포함한다. BackendApplication.java가 실제 진입점이며 MuscleupApplication.java는 패키지 이름 변경 후 남은 빈 스텁이다.',
    nodeIds: [...beEntry, ...g('backend/config'), ...g('backend/resources'), ...g('backend/uploads')],
  },
  {
    id: 'layer:frontend-ui',
    name: '프론트엔드 UI 레이어',
    description: 'React 19 라우트 페이지, 재사용 컴포넌트, Header/Footer/Logo 레이아웃, 화면별 CSS와 Tailwind 기반 전역 스타일로 구성된다. App.tsx가 코드 스플리팅과 권한 기반 라우팅을 담당하고 main.tsx와 index.html이 PWA 부트스트랩을 수행한다.',
    nodeIds: [...g('frontend/pages'), ...g('frontend/components'), ...g('frontend/layouts'), ...g('frontend/styles'), ...feUiRoot],
  },
  {
    id: 'layer:frontend-data-access',
    name: '프론트엔드 데이터 접근·유틸리티 레이어',
    description: '도메인별 API 클라이언트(admin·event·crew·friend), 토큰 갱신을 처리하는 axios/fetch 래퍼와 TanStack Query 클라이언트, 백엔드 DTO와 대응하는 공용 타입, 그리고 아바타 상태·성장 계산·이미지 업로드·공유 카드 생성 유틸리티를 제공한다. UI 레이어와 백엔드 REST API 사이의 경계를 담당한다.',
    nodeIds: [...g('frontend/services'), ...g('frontend/lib'), ...g('frontend/types'), ...g('frontend/utils'), ...feDataRoot],
  },
  {
    id: 'layer:realtime',
    name: '실시간 라운지 서비스',
    description: '4001 포트에서 동작하는 독립 Socket.IO 서버로, server.ts가 접속·이동·채팅 이벤트를 처리하고 rooms.ts가 인메모리 방 레지스트리를 관리하며 types.ts가 클라이언트와 공유하는 이벤트 계약을 정의한다. HTTP가 아닌 웹소켓으로 통신하므로 다른 서비스와 import 의존이 전혀 없다.',
    nodeIds: [...g('realtime/(root)')],
  },
  {
    id: 'layer:build-deploy',
    name: '빌드·배포·테스트 인프라',
    description: 'Gradle 빌드 스크립트와 wrapper, nixpacks 기반 백엔드 배포 설정, Vite·TypeScript·Tailwind·PostCSS·ESLint 프론트엔드 빌드 체인, Vercel SPA 배포 설정, 그리고 JUnit 스모크 테스트와 AI 인바디 품질 검증 하니스 및 픽스처를 묶는다.',
    nodeIds: [...beBuildRoot, ...g('backend/gradle'), ...feBuildRoot, ...g('backend/test'), ...g('.ua')],
  },
  {
    id: 'layer:documentation',
    name: '문서',
    description: '프로젝트 개요와 셋업 절차를 담은 루트 README, 서비스 전반을 설명하는 마스터 기획 문서, AI 인바디 품질 검증 플레이북 등 기능 검증·온보딩 문서를 모은다.',
    nodeIds: [...g('docs'), ...g('(root)'), ...feDocRoot],
  },
];

// --- validation ---
const seen = new Map();
let dup = 0;
layers.forEach(l => {
  if (!l.nodeIds.length) throw new Error('empty layer ' + l.id);
  l.nodeIds.forEach(id => {
    if (!byId.has(id)) throw new Error('unknown node id ' + id);
    if (seen.has(id)) { dup++; console.error('DUPLICATE ' + id + ' in ' + l.id + ' and ' + seen.get(id)); }
    seen.set(id, l.id);
  });
});
const missing = input.fileNodes.filter(n => !seen.has(n.id)).map(n => n.id);
if (missing.length) { console.error('MISSING ' + missing.length); missing.forEach(m => console.error('  ' + m)); }
if (dup || missing.length) process.exit(1);

const outDir = path.join(root, '.ua/intermediate');
fs.writeFileSync(path.join(outDir, 'layers.json'), JSON.stringify(layers, null, 2), 'utf8');
console.log('layers=' + layers.length + ' assigned=' + seen.size + '/' + input.fileNodes.length);
layers.forEach(l => console.log('  ' + String(l.nodeIds.length).padStart(4) + '  ' + l.id + '  ' + l.name));
