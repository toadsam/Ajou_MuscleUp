# 2026-10-11 · 커뮤니티(자랑방 · 공동구매 · 후기) 수정 기록

전체 점검에서 나온 커뮤니티 영역 문제를 고친 기록. 용어는 이번에 **공동구매**(공구/나눔 모집 대신, 주소 `/protein`, `/proteins/:id` 는 그대로), 자랑방 좋아요는 **응원** 으로 통일했다.

담당 파일
- 프론트: `pages/Reviews.tsx`, `WriteReview.tsx`, `Protein.tsx`, `WriteProtein.tsx`, `ProteinDetail.tsx`, `BragList.tsx`, `BragDetail.tsx`, `BragWrite.tsx`
- 프론트 새 파일: `utils/reviewContent.ts`(후기 두 칸 합치기/나누기), `utils/proteinMeta.ts`(분배 방식 · 남은 기간 · 설명 줄 읽기), `utils/bragHidden.ts`(이 기기에서 숨김)
- 백엔드(`backend/src/main/java/com/ajou/muscleup/`): `entity/Protein.java`, `dto/protein/ProteinCreateUpdateRequest.java`, `dto/protein/ProteinResponse.java`, `repository/ProteinRepository.java`, `service/ProteinService.java`, `service/ProteinServiceImpl.java`, `service/ProteinShareServiceImpl.java`, `controller/ProteinController.java`, `dto/review/ReviewResponse.java`, `dto/review/ReviewCreateRequest.java`, `dto/review/ReviewUpdateRequest.java`, `repository/ReviewRepository.java`, `service/ReviewService.java`, `service/ReviewServiceImpl.java`(목록 · 작성 부분만, 관리자 확인 줄은 다른 영역), `controller/ReviewController.java`

공통으로 한 것
- 각 페이지의 `api()` 도우미: `alert()` → `toast()`, `throw new Error(text || \`HTTP ${status}\`)` → `throw await httpError(res, "…")`, `catch (e: any) { e?.message }` → `friendlyError(e, "…")`. 서버 원문 · "HTTP 500" 이 화면에 나오지 않는다.
- 응답 본문이 비어 있으면(`DELETE` 의 204) `res.json()` 대신 `res.text()` 로 읽는다. 예전 `Reviews.tsx` 는 후기 삭제가 성공해도 `res.json()` 에서 예외가 나 "삭제에 실패했습니다" 경고가 떴다.
  ```diff
  -  return res.json();
  +  const text = await res.text();
  +  return (text ? JSON.parse(text) : null) as T;
  ```

---

### 1. 후기 작성자가 늘 "익명 회원", 내 후기를 고치거나 지울 수 없음

- **문제**: 후기 목록의 작성자가 모두 "익명 회원"이고, 내가 쓴 후기에도 수정 · 삭제 버튼이 없었다. 제품 이름(모집글)도 안 나왔다.
- **원인**: 프론트(`Reviews.tsx:11-13,117,301`)는 `userNickname`, `userEmail`, `proteinName` 을 읽는데 서버 `ReviewResponse.java:9` 는 `nickname`, `userId`, `proteinId` 를 보냈다. 이름이 하나도 맞지 않아 닉네임은 늘 비고, `rev.userEmail === myEmail` 은 늘 거짓.
- **고친 코드**
  - `dto/review/ReviewResponse.java` — `proteinName`, `mine` 추가. `from(Review, String viewerEmail)` 에서 보는 사람 이메일과 작성자 이메일을 비교해 `mine` 을 채운다. 작성자 이메일은 응답에 싣지 않는다.
    ```diff
    +    private String proteinName; // 어떤 공동구매 후기인지 목록에 보여 준다
    +    private boolean mine;       // 보는 사람이 쓴 후기인지(수정 · 삭제 버튼용, 이메일은 내보내지 않는다)
    ...
    +                .proteinName(r.getProtein().getName())
    +                .mine(viewerEmail != null && viewerEmail.equalsIgnoreCase(r.getUser().getEmail()))
    ```
  - `controller/ReviewController.java` — `list` 가 `@AuthenticationPrincipal String email` 을 받아 서비스에 넘긴다. `service/ReviewService.java`, `ReviewServiceImpl.listByProtein(proteinId, pageable, viewerEmail)`. `create` 의 반환도 `ReviewResponse.from(saved, userEmail)`.
  - `repository/ReviewRepository.java` — `findByProtein_Id` 에 `@EntityGraph(attributePaths = {"user", "protein"})`: 닉네임 · 제품 이름 때문에 후기마다 생기던 추가 조회를 없앴다.
  - `pages/Reviews.tsx` — `Review` 타입을 서버 이름(`nickname`, `userId`, `proteinId`, `proteinName`, `mine`)으로 맞춤. 수정 · 삭제 버튼은 `rev.mine || isAdmin`.
    ```diff
    -  userEmail?: string | null;
    -  userNickname?: string | null;
    +  nickname?: string | null;
    +  proteinId?: number | null;
    +  mine?: boolean;
    ...
    -    () => (rev: Review) => !!myEmail && (rev.userEmail === myEmail || isAdmin),
    +  const canEdit = (rev: Review) => !!user && (!!rev.mine || isAdmin);
    ```
    작성자 칸은 `r.nickname || "회원"`, 내 후기에는 "내 후기" 칩. 전체 보기일 때는 "공동구매: 제품 이름" 버튼으로 그 제품 후기만 볼 수 있다.
- **확인**: `compileJava` 성공. 8091 포트로 바뀐 백엔드를 띄워(로컬 프로필) JPQL · 엔티티 그래프가 시작 시 검증을 통과함. 프론트는 가짜 응답(`mine: true` 후기 1개, 아닌 것 1개)으로 `/reviews` 를 띄워 닉네임 · "내 후기" · 수정/삭제 버튼이 내 후기에만 나오는 것 확인.
- **남은 것**: 실제 로그인 상태에서 서버가 `mine` 을 맞게 채우는지는 로그인이 필요해 직접 호출로 확인하지 못했다.

### 2. 후기를 수정하면 1번 제품 후기로 보일 수 있음

- **문제**: 후기 수정 화면의 제품 칸이 원래 제품이 아니라 1번(또는 목록 첫 제품)으로 바뀌어 있었다.
- **원인**: 수정 버튼(`Reviews.tsx:331`)이 넘기는 `review` 에 `proteinId` 가 없었고(응답 이름 불일치), `WriteReview.tsx:56,68` 이 `?? 1` 로 채웠다. 서버 `ReviewUpdateRequest` 에는 `proteinId` 가 없어 실제로 제품이 바뀌지는 않았지만(무시됨), 화면은 다른 제품을 보여 주고 고를 수도 있게 했다.
- **고친 코드**
  - `pages/Reviews.tsx` — 수정 버튼이 `/reviews/write?proteinId=${r.proteinId}` 로 가며 `state.review` 에 `id, rating, content, proteinId` 를 넘김.
  - `pages/WriteReview.tsx` — 기본값 1 제거. 제품은 `editing.proteinId` → 주소 `?proteinId=` → 없으면 빈 칸("공동구매를 골라 주세요")에서 직접 고름. 수정 모드에서는 `<select disabled>` + "후기를 쓴 공동구매는 바꿀 수 없어요." 안내. PATCH 본문에는 `rating, content` 만 보낸다.
    ```diff
    -    proteinId: editing?.proteinId ?? 1,
    +  const initialProteinId =
    +    editing?.proteinId ?? (Number.isInteger(pidFromUrl) && pidFromUrl > 0 ? pidFromUrl : null);
    ...
    -              disabled={!hasProtein}
    +              disabled={isEdit}
    ```
- **확인**: 가짜 응답으로 11번 제품 후기의 "수정" 클릭 → 주소 `/reviews/write?proteinId=11`, 선택값 11, `disabled: true`, 제품 후기/공동구매 경험 칸이 원래 글로 채워짐(브라우저 스크립트로 값 확인, 375px 화면 캡처).

### 3. 근거 없는 지표 "대표 신뢰도 · 분배 약속 이행 · 재참여 의향"

- **문제**: 후기 화면이 평균 별점만으로 "대표 신뢰도", "분배 약속 이행"(평균 - 0.1), "재참여 의향"(평균/5×100%)을 계산해 실제 측정값처럼 보여 줬다.
- **원인**: `Reviews.tsx:170-174` 에서 평균으로 만든 숫자.
- **고친 코드**
  - `pages/Reviews.tsx` — `summary` 는 `{ avg, count }` 만. "한눈에 보기"에 평균 만족도(게이지)와 후기 수만 남김. 퍼센트 모드와 `getTrustBadge`(별점으로 "강력 추천/신뢰 가능" 딱지)도 제거. 머리말 문구를 "대표 구매자가 믿을 만한지 확인하는 공간"에서 사실대로(참여 회원이 남긴 제품 후기 · 공동구매 경험) 바꿈.
    ```diff
    -    const trust = Math.max(0, Math.min(5, avg));
    -    const punctual = Math.max(0, Math.min(5, avg - 0.1));
    -    const reDeal = Math.round((avg / 5) * 100);
    +    return { avg, count: items.length };
    ```
  - `pages/ProteinDetail.tsx` — 같은 종류의 지어낸 값도 정리: "재거래 의향 %"(평균으로 계산) → "후기 수", "작성자 신뢰 지표"(완료 공구 수 = 평점×3, "꾸준히 완료한 사용자입니다" 문장) 칸 삭제. 후기가 없으면 "아직 후기가 없어요." (예전엔 0.0/5)
- **확인**: 가짜 응답 화면에서 "평균 만족도", "후기 수 2개" 만 보이는 것 확인.

### 4. "N일 남음" 이 줄지 않고 모집이 자동으로 닫히지 않음

- **문제**: 7일 모집으로 올리면 몇 주가 지나도 "7일 남음", 상태는 늘 "모집 중"이었다.
- **원인**: 글쓰기(`WriteProtein.tsx:181`)가 모집 기간 숫자만 `days` 로 저장하고, 목록(`Protein.tsx:75-79,437`)은 그 숫자를 그대로 "N일 남음"으로 보여 줬다. 등록 시각도 저장하지 않았다(`Protein` 은 `BaseTimeEntity` 를 상속하지 않아 `createdAt` 이 없다).
- **고친 코드**
  - `entity/Protein.java` — nullable 컬럼 `deadline`(LocalDate) 추가.
  - `service/ProteinServiceImpl.java` — 등록 때 `deadline = 오늘(Asia/Seoul) + days`. 수정에서 `days` 를 바꾸면 오늘부터 다시 센다.
    ```diff
    +    private static LocalDate deadlineFrom(Integer days) {
    +        return days != null && days > 0 ? LocalDate.now(KST).plusDays(days) : null;
    +    }
    ...
    +                .deadline(deadlineFrom(req.getDays()))
    ```
  - `dto/protein/ProteinResponse.java` — `deadline`, `daysLeft`(오늘 기준 남은 날, 지났으면 음수), `closed`(마감일이 지남)를 서버가 계산해 내려준다.
  - `service/ProteinShareServiceImpl.java` — `apply`: 마감일이 지난 모집에는 새 신청을 400 "모집이 마감된 공동구매예요." 로 막음(이미 신청한 사람은 기존 신청을 그대로 돌려줌).
  - `utils/proteinMeta.ts` — `remainingLabel`: 마감일 없음 → "마감일 미정", 지남 → "마감", 0 → "오늘 마감", 그 밖 → "N일 남음". `isClosed`.
  - `pages/Protein.tsx` — 상태는 `closed` 로만("모집 중"/"모집 마감"). 상태 필터에서 마감 글이 걸러지고, 위 세 칸 강조는 모집 중인 글만. "마감 임박순"은 `daysLeft` 기준(마감일 없는 글, 마감된 글 순으로 뒤). 근거 없던 "분배 완료"(후기가 있으면 분배 완료로 짐작) 상태와 필터 항목 삭제.
  - `pages/ProteinDetail.tsx` — "마감까지 N일" → `remainingLabel` + "10월 16일 마감". 단계 막대는 "모집 중 → 모집 마감" 두 칸. 마감되면 "참여하기" 대신 "모집이 마감되어 새로 신청할 수 없어요."
  - `pages/WriteProtein.tsx` — 모집 기간 칸에 `max={365}` 와 "오늘부터 센 날짜가 지나면 자동으로 마감돼요." 안내. 서버 요청도 `@Min(1) @Max(365)`.
- **마이그레이션 선택**: 예전 글은 등록 시각이 저장되지 않아 `createdAt + days` 로 되살릴 수 없다. 지어내지 않고 `deadline = null` 로 두어 "마감일 미정 · 모집 중"으로 보인다. 필요하면 운영진이 모집 기간을 다시 저장(수정)하면 그날부터 마감일이 생긴다.
- **확인**: 바뀐 백엔드를 8091 에 띄운 뒤 로컬 DB `information_schema` 를 읽기 전용으로 조회: `deadline(date)`, `receipt_url(varchar)`, `image_public(bit)`, `distribution_method(varchar)` 모두 `IS_NULLABLE = YES` 로 추가됨(ddl-auto=update). 프론트는 가짜 응답(남은 5일 / 이틀 전 마감 / 마감일 없음)으로 "5일 남음 · 모집 중", "마감 · 모집 마감", "마감일 미정 · 모집 중" 과 상태 필터 "모집 중" → 마감 글 빠짐을 확인. `remainingLabel` 은 node 로 -1/0/3/없음 입력을 돌려 확인.
- **남은 것**: 운영 DB(Postgres)에도 컬럼 4개가 ddl-auto=update 로 생겨야 한다(배포 후 첫 기동 로그 확인). 목표 인원이 다 차면 마감하는 규칙은 없다(승인 인원 기준 마감은 요청 범위 밖).

### 5. "1인 부담 낮은 순" 이 총 금액으로 정렬됨

- **원인**: `Protein.tsx:124-125` 가 `a.price - b.price`.
- **고친 코드**: `pages/Protein.tsx` — `perPersonOf(p) = ceil(price / goal)` 로 정렬, 값이 없는 글은 뒤로. 카드 · 강조 칸의 1인 부담금도 같은 함수.
  ```diff
  -  const sortByPriceAsc = () =>
  -    setProducts((p) => [...p].sort((a, b) => (a.price ?? 0) - (b.price ?? 0)));
  +  const sortByPerPersonAsc = () =>
  +    setProducts((p) => [...p].sort((a, b) => (perPersonOf(a) ?? 9e15) - (perPersonOf(b) ?? 9e15)));
  ```
- **확인**: 가짜 응답(총 120,000/4명, 90,000/2명, 60,000/6명)에서 버튼을 누르니 1인 10,000 → 30,000 → 45,000 순(총 금액 순이면 60,000 → 90,000 → 120,000 으로 달라짐).

### 6. 영수증 사진이 공개 목록 썸네일로 쓰임

- **문제**: 글쓰기의 "영수증/실구매 인증 이미지"가 그대로 목록 카드 썸네일과 상세 대표 사진이 되어, 로그인한 누구나 영수증(이름 · 카드 끝자리 · 주소가 찍힐 수 있음)을 봤다.
- **원인**: `WriteProtein.tsx:298-311` 이 업로드 결과를 `imageUrl` 에 넣고, `Protein.tsx:381`, `ProteinDetail.tsx:326,358` 이 `imageUrl` 을 썸네일 · 대표 사진 · 영수증 칸에 모두 썼다. 업로드 폴더도 기본값 `gallery`(공개 갤러리 목록에 나오는 폴더)였다.
- **고친 코드**
  - `entity/Protein.java` — `receiptUrl`(영수증), `imagePublic`(imageUrl 이 공개용 대표 이미지인지) 컬럼 추가.
  - `dto/protein/ProteinResponse.java` — `imageUrl` 은 `imagePublic == TRUE` 일 때만 내려줌. `receiptUrl` 은 기본 null, `receiptOf(p)` 로 원본(새 `receiptUrl`, 없으면 예전 글의 `imageUrl`)을 구한다.
    ```diff
    -                .imageUrl(p.getImageUrl())
    +                .imageUrl(Boolean.TRUE.equals(p.getImagePublic()) ? p.getImageUrl() : null)
    ...
    +    public static String receiptOf(Protein p) {
    +        if (p.getReceiptUrl() != null && !p.getReceiptUrl().isBlank()) return p.getReceiptUrl();
    +        return Boolean.TRUE.equals(p.getImagePublic()) ? null : p.getImageUrl();
    +    }
    ```
  - `service/ProteinServiceImpl.java` — `canSeeReceipt(p, email)`: 작성자 · 관리자(`RoleUtils.isAdmin`) · 승인(`APPROVED`)된 참여자만 true. 새 글은 `imagePublic = TRUE`. 수정으로 예전 글에 대표 이미지를 넣으면, 덮기 전에 예전 imageUrl 을 `receiptUrl` 로 옮긴다.
  - `controller/ProteinController.java` — 상세 · 등록 · 수정 응답은 `detail(p, email)`: `canSeeReceipt` 일 때만 `receiptUrl` 을 채움. 목록에는 영수증을 싣지 않는다.
  - `pages/WriteProtein.tsx` — 업로드 칸을 둘로: "대표 이미지(선택, 목록에 보여요)" → `imageUrl`, "영수증/실구매 인증(선택)" → `receiptUrl` + "작성자, 운영진, 승인된 참여자에게만 보여요." 두 업로드 모두 `folder="protein"`(일반 회원이 목록을 볼 수 없는 폴더, 서버 허용 목록은 보안 영역에서 추가). 미리보기 alt 를 "대표 이미지 미리보기"/"영수증 미리보기", 예시 주소 placeholder(`https://example.com/receipt.jpg`)를 "또는 이미지 주소를 붙여 넣기"로.
    ```diff
    -            <UploadDropzone accept="image/*" multiple={false}
    -              onUploaded={(url) => setForm((prev) => ({ ...prev, image: url }))} />
    +            <UploadDropzone accept="image/*" multiple={false} folder="protein"
    +              onUploaded={(url) => setForm((prev) => ({ ...prev, receipt: url }))} />
    ```
  - `pages/ProteinDetail.tsx` — 영수증 칸은 `data.receiptUrl`(alt "영수증 사진"). 못 보는 사람에게는 "작성자, 운영진, 승인된 참여자에게만 보여요." 작성자 판정은 서버의 `mine`(응답에서 `ownerEmail` 은 이제 비워 보낸다).
- **마이그레이션 선택(예전 글)**: 예전 글의 `imageUrl` 은 모두 "영수증" 칸으로 올린 것이므로 영수증으로 본다. `imagePublic` 이 null 인 글은 목록 썸네일 · 상세 대표 사진에서 빠지고, 상세의 영수증 칸에서 작성자 · 운영진 · 승인된 참여자에게만 보인다. 데이터는 지우거나 옮기지 않는다(조회 때 해석만 다름).
- **확인**: 컴파일 · 기동 성공, 가짜 응답으로 영수증 안내 문구 확인.
- **남은 것**: 이미 `gallery` 폴더에 올라간 예전 영수증 파일은 주소를 알면 열 수 있고, 운영진 갤러리 목록에도 남아 있다(파일 이동/삭제는 하지 않음 — 운영진 결정 필요). 승인된 참여자로 실제 로그인해 영수증이 보이는지는 확인하지 못했다.

### 19. 공동구매 · 후기 목록: 페이지 크기 제한 없음 + 글마다 평균 평점 쿼리

- **원인**: `ProteinController.java:51` 과 `ReviewController.java:34` 가 `size` 를 그대로 `PageRequest.of` 에 넣었고(`size=100000` 가능), 공동구매 목록은 글마다 `averageRating(id)` 쿼리를 따로 날렸다(N+1).
- **고친 코드**
  - `controller/ProteinController.java`, `controller/ReviewController.java` — `size` 를 1~50 으로 자르고 `page` 음수 방지, 최신 글 먼저(`Sort id DESC`).
    ```diff
    -        Pageable pageable = PageRequest.of(page, size);
    +        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), MAX_PAGE_SIZE),
    +                Sort.by(Sort.Direction.DESC, "id"));
    ```
  - `repository/ReviewRepository.java` — `ratingStatsByProteinIds(ids)`: `select r.protein.id, avg(r.rating), count(r) ... where r.protein.id in :ids group by r.protein.id` 한 번으로 한 페이지 전체의 평균 · 후기 수. `countByProteinId` 추가.
  - `service/ProteinServiceImpl.ratingStats` — 위 결과를 `Map<id, [avg, count]>` 로. 후기가 없는 글은 `avgRating = null`, `reviewCount = 0` (예전엔 `coalesce(avg, 0)` 때문에 후기 없는 글이 "0.0 평점"으로 보였다).
  - `repository/ProteinRepository.java` — `findAll(Pageable)`, `findByNameContainingIgnoreCase` 에 `@EntityGraph("owner")`: 작성자 닉네임 때문에 글마다 생기던 조회도 없앰.
  - 프론트는 목록을 `?size=50` 으로 부른다(`Protein.tsx`, `Reviews.tsx`, `WriteReview.tsx`).
- **확인**: 바뀐 백엔드 기동 시 JPQL 검증 통과. 실제 쿼리 수는 로그인이 필요해 재지 못했다.
- **남은 것**: 공동구매가 50개를 넘으면 목록 · 후기 제품 선택에 51번째부터 나오지 않는다(페이지 넘김 UI 없음).

### 20. 자랑방 "자극됨/도움됨" · "차단"이 이 기기에만 저장되는데 모두에게 반영되는 것처럼 보임

- **문제**: 상세의 "자극됨/도움됨"은 `localStorage` 에만 저장돼 다른 사람은 볼 수 없었다. "차단"도 이 브라우저에만 저장되는데 이름이 서버 차단처럼 보였고, 차단한 작성자의 글이 목록에는 그대로 나왔다.
- **원인**: `BragDetail.tsx:136-157,278-281`(`brag_reactions`, `brag_blocked_authors` 로컬 저장), `BragList.tsx` 는 차단 목록을 읽지 않음.
- **고친 코드**
  - `pages/BragDetail.tsx` — "자극됨/도움됨" 버튼과 `LocalReactions` 저장 코드 삭제(아무도 못 보는 반응이라 오해만 줌). "차단" → "이 기기에서 숨기기"(작성자 본인 글에는 안 보임), 숨긴 글 화면은 "이 기기에서 숨긴 작성자의 글이에요. / 숨김 해제", 누르면 토스트로 "다른 사람에게는 그대로 보여요." 안내.
  - `utils/bragHidden.ts`(새 파일) — `getHiddenAuthors / setHiddenAuthors / toggleHiddenAuthor / authorKey`. 저장 키는 예전과 같은 `brag_blocked_authors` 라 이미 숨겨 둔 작성자가 유지된다. 작성자 키는 `authorEmail`, 없으면 `id:<authorId>`.
  - `pages/BragList.tsx` — 목록에서도 숨긴 작성자 글을 뺀다. 빠진 글이 있으면 "이 기기에서 숨긴 작성자의 글 N개를 빼고 보여 주고 있어요. [모두 다시 보기]".
    ```diff
    +      .filter((post) => !isHidden(post))
         .filter((post) => (visibilityFilter === "FRIENDS" ? post.visibility === "FRIENDS" : true))
    ```
- **확인**: 가짜 응답(작성자 2명)으로 상세에서 "이 기기에서 숨기기" → 숨김 화면 · 토스트, 목록으로 가니 1개만 남고 안내 줄이 보이는 것 확인. 확인 뒤 테스트용 localStorage 값은 지웠다.
- **남은 것**: 서버 쪽 차단 기능은 없다(요청 범위 밖). 다른 영역에서 자랑글 응답의 `authorEmail` 을 빼면 숨김 키가 `id:<authorId>` 로 바뀌므로, 그때는 응답에 `authorId` 가 있어야 한다(예전에 이메일로 숨긴 값은 다시 숨겨야 함).

### 21. 좋아요/응원 이름이 화면마다 다름

- **고친 코드**: `pages/BragList.tsx` — 카드 칩 "좋아요 N" → "응원 N", 버튼 "좋아요" → "응원", 실패 문구 "응원을 반영하지 못했어요." (상세는 이미 "응원")
- **확인**: 가짜 응답 목록 화면 문구 확인, `grep 좋아요` 결과 없음(별점 설명 "좋아요" 제외).

### 22. 공동구매 이름이 "공구 모집 등록", "나눔 모집글" 로 섞임

- **고친 코드**
  - `pages/Protein.tsx` — "공구 모집 등록" → "공동구매 모집 등록", "공구 찾기" → "공동구매 찾기", "공구 링크" → "공동구매 링크", 로딩 문구, 빈 사진 칸 "Group Buy" → "공동구매".
  - `pages/WriteProtein.tsx` — 제목 "나눔형 공동구매 모집글 등록" → "공동구매 모집글 등록", 안내 문구, 버튼 "나눔 모집글 등록" → "공동구매 모집글 등록", 토스트 "공동구매 모집글을 등록했어요."
  - `pages/ProteinDetail.tsx` — "나눔 모집글", "공구 후기 요약", "공구 소통 공간", "공구 전용 소통 공간" → 공동구매.
- **확인**: 담당 8개 파일에서 `grep "공구\|나눔"` 결과 없음.

### 24. 후기 화면은 두 칸(제품 후기/공동구매 경험)인데 작성은 한 칸

- **문제**: 목록은 본문을 빈 줄로 나눠 두 칸으로 보여 주는데, 작성 화면은 칸이 하나라 사용자가 구분을 알 수 없었다. 빈 줄이 없으면 같은 글이 두 칸에 똑같이 두 번 나왔다(`Reviews.tsx:66`).
- **고친 코드**
  - `utils/reviewContent.ts`(새 파일) — `REVIEW_SEPARATOR = "\n\n"`(예전과 같음), `splitReview`(빈 줄이 없으면 경험 칸은 비움), `joinReview`(제품 후기 칸 안의 빈 줄은 한 줄로 줄여 나눌 때 섞이지 않게).
  - `pages/WriteReview.tsx` — "제품 후기"(필수)와 "공동구매 경험(선택)" 두 칸, `<label htmlFor>` 연결. 두 칸 합친 길이 `n / 1000` 표시, 넘으면 저장 막음(서버 `Review.content` 길이 1000, 요청 DTO 에 `@Size(max = 1000)` 추가). 수정 때는 저장된 본문을 `splitReview` 로 나눠 채운다.
  - `pages/Reviews.tsx` — 경험 칸이 있으면 두 칸, 없으면(예전 한 칸 글) "후기" 한 칸만.
- **확인**: node 로 `joinReview("맛 좋음\n\n용해 잘됨", "분배 빠름\n\n친절")` → `"맛 좋음\n용해 잘됨\n\n분배 빠름\n\n친절"` → 다시 나누면 그대로 두 칸. 예전 한 칸 글은 `{product: 글, share: ""}`. 화면에서도 두 경우 확인.

### 25. 후기 화면이 처음에 1번 제품을 불러오고, 주소와 선택값이 서로 덮어씀

- **원인**: `Reviews.tsx:109` 기본값 `1`, `:125` `selectedProtein ?? 1`, `:136-143` 선택값이 바뀌면 주소를 쓰고 주소가 바뀌면 다시 불러오는 효과, `:151` 첫 제품으로 덮어쓰기. "후기 작성하기"(`:192`)는 선택한 제품을 넘기지 않았다.
- **고친 코드**: `pages/Reviews.tsx` — 선택값을 상태로 두지 않고 주소 `?proteinId=` 에서만 읽음. 없으면 전체 후기(서버 `proteinId` 를 선택값으로 바꾸고 `findAllBy` 추가). 선택 상자에 "전체 공동구매" 항목. "후기 작성하기"는 `/reviews/write?proteinId=선택값`. 요청이 겹칠 때 늦게 온 응답이 덮지 않게 `cancelled` 처리.
  ```diff
  -  const [selectedProtein, setSelectedProtein] = useState<number | null>(1);
  +  const pidParam = Number(searchParams.get("proteinId"));
  +  const selectedProtein = Number.isInteger(pidParam) && pidParam > 0 ? pidParam : null;
  ```
- **확인**: 가짜 응답으로 `/reviews` 진입 → 주소에 `proteinId` 가 붙지 않고 전체 2개. 제품 이름 버튼 클릭 → 선택 상자 11, "후기 작성하기" 링크 `/reviews/write?proteinId=11`.

### 26. 지어낸 "초보 추천 이유"와 설명 낱말로 짐작한 분배 방식

- **원인**: `Protein.tsx:82-92 getBeginnerReason` 이 평점 · 금액 · 기간으로 추천 문장을 만들고, 해당이 없으면 늘 "직접 만나서 분배받기 쉬워요". `:68-73 getDistributionType` 은 설명에 "보관"이 있으면 헬스장 보관, 아니면 늘 "직접 분배". 상세(`ProteinDetail.tsx:60-65`)도 같은 방식, 게다가 총 용량을 "목표 인원 N인분", 브랜드를 제품명 첫 낱말로 지어냈다.
- **고친 코드**
  - 백엔드 — `Protein.distributionMethod`(nullable, 20자) 컬럼, 요청 DTO 필드. 서버는 "직접 만나서 / 헬스장 보관함 / 택배 / 기타" 만 저장하고 그 밖의 값은 null(`normalizeDistribution`).
  - `pages/WriteProtein.tsx` — 분배 방식 네 버튼(선택, 다시 누르면 해제), 값은 `distributionMethod` 로 전송. 설명 글에 "분배 방식:" 줄을 더 이상 넣지 않는다.
  - `utils/proteinMeta.ts` — `distributionOf(p)`: `distributionMethod`, 없으면 예전 글쓰기 화면이 직접 써 넣은 "분배 방식: …" 줄(사용자가 고른 값, "직접 만남" → "직접 만나서"). 둘 다 없으면 null → 화면에 "정보 없음". 낱말 짐작은 하지 않는다.
  - `pages/Protein.tsx` — `getBeginnerReason` 삭제. 카드 설명 줄은 실제 값만: "후기 N개 · 평균 X점", "분배: …". 없으면 줄 자체가 없음. 강조 칸은 남은 기간과 1인 부담금. 분배 필터 항목은 네 값 + "정보 없음".
  - `pages/ProteinDetail.tsx` — 총 용량 · 1인 분배 · 브랜드는 작성자가 적은 줄만, 없으면 "미정"/숨김. 목표 인원이 없을 때 기본 4명 대신 "목표 인원 미정".
- **확인**: node 로 `distributionOf({description: "헬스장 보관 예정, 직접 연락"})` → null(예전엔 "헬스장 보관"), 예전 줄 "분배 방식: 직접 만남" → "직접 만나서", 새 필드 "택배" → "택배". 화면에서 "정보 없음" 표시 확인.

### 그 밖의 정리

- **alert → toast**: `BragDetail`(11곳), `BragList`, `BragWrite`, `Protein`, `ProteinDetail`, `WriteProtein`, `Reviews`, `WriteReview` 의 모든 `alert` 를 `toast(…, "success" | "error")` 로. 담당 파일에 `alert(` 없음. (`confirm` 삭제 확인은 그대로)
- **주황색 강조 → 원판 색**: `text-orange-300/bg-orange-500/border-l-orange-500` → `text-plate-yellow`/`bg-plate-yellow`/`border-l-plate-yellow` (`Reviews`, `Protein`, `ProteinDetail`, `WriteProtein`, `BragList`, `BragDetail`, `BragWrite`). 담당 파일에 `orange` 없음.
- **영어 alt → 한국어**: `BragDetail` "before/after/media/lightbox" → "운동 전(Before) 사진", "운동 후(After) 사진", "<제목> 첨부 사진", "크게 본 사진". `ProteinDetail` "receipt" → "영수증 사진". `BragWrite` "media/preview" → "첨부한 사진", "미리보기 사진".
- **별점 입력**: `WriteReview.tsx:137-162` 의 `aria-hidden` 막대 + 별도 숫자 칸 → `fieldset/legend "별점"` 안의 라디오 5개(`sr-only` 입력 + 막대 모양, `aria-label="5점 · 아주 좋아요"`). 키보드 화살표로 고를 수 있고 포커스 때 노란 외곽선. 숫자 입력 칸 삭제.
- **깨진 `??` 이모지(백로그)**: `BragDetail.tsx` 댓글 빠른 삽입 `["??", "??", "??", "??", "?"]` 는 이 버튼에서만 쓰였다(`grep` 확인). 원래 이모지를 알 수 없고 디자인 규칙상 이모지 UI 를 쓰지 않으므로, 짧은 응원 문구 "멋져요 / 응원해요 / 자극받고 가요 / 꾸준함 최고 / 다음 기록도 기대돼요" 로 바꿨다. `docs/fix-log.md` 남은 문제 표에서 `BragDetail.tsx` 를 지움(`AttendanceShareView.tsx` 는 남음).
- **영어 오류 문구(백엔드)**: `ProteinServiceImpl.get` 404 "Protein not found" → "공동구매 글을 찾을 수 없어요."

## 확인 요약

- 프론트: `npx tsc -p tsconfig.app.json --noEmit` — 담당 파일 · 새 파일 오류 0(다른 영역 작업 중인 `Friends.tsx`, `Members.tsx`, `Lounge.tsx` 오류는 이 영역 밖). `node scripts/lint-diff.mjs` — 담당 파일 린트 문제 BragDetail 8→0, BragList 2→0, BragWrite 1→0, Protein 2→0, ProteinDetail 4→0, Reviews 4→0, WriteProtein 1→0, WriteReview 4→0, 새 파일 0.
- 백엔드: `gradlew compileJava` 성공. 바뀐 코드를 8091 포트 · 로컬 프로필로 따로 띄워 시작 성공(JPQL · EntityGraph 검증, 컬럼 4개 추가) 뒤 종료. 8080 에서 돌던 서버는 건드리지 않았다(재시작 필요).
- 화면: 로그인이 필요한 화면이라, 로컬 개발 서버에서 브라우저 `fetch` 를 가짜 응답으로 바꿔(테스트용 사용자 값은 localStorage 에 넣었다가 확인 뒤 지움) `/protein`, `/proteins/12`, `/reviews`, `/reviews/write?proteinId=11`, `/brag`, `/brag/21`, `/protein/write` 를 데스크톱과 375px 로 띄움. 375px 에서 다섯 화면 모두 가로 넘침 없음(`scrollWidth 375`).

## 남은 것 (다른 영역 필요 / 확인 못 함)

- 실제 서버 응답으로는 확인하지 못했다(Google 로그인 필요). 로그인 후 확인할 것: 내 후기에만 수정/삭제, 승인된 참여자에게 영수증 보임, 마감 글에 신청 시 "모집이 마감된 공동구매예요."
- 8080 의 백엔드는 예전 코드로 돌고 있으므로 다시 띄워야 바뀐 응답(`mine`, `deadline`, `closed`…)이 나온다. 운영(Postgres)도 배포 후 첫 기동에서 컬럼 4개가 생기는지 로그 확인.
- 예전 영수증 파일이 `gallery` 폴더에 남아 있음(운영진 결정).
- 자랑글 응답(`BragPostResponse`, 다른 영역)에서 `authorEmail` 을 빼게 되면 `authorId` 를 넣어야 "이 기기에서 숨김"이 계속 동작한다.
- 목록 50개 넘는 공동구매/후기의 페이지 넘김 UI 없음.
