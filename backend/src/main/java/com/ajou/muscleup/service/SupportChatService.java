package com.ajou.muscleup.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class SupportChatService {

    private static final int TOP_K = 4;
    private static final String BOT_NAME = "득근이";
    private final AiService aiService;

    private final List<Doc> docs = List.of(
            new Doc("home", "홈", "/", "홈에서는 서비스 소개와 주요 기능으로 이동할 수 있다.", List.of("홈", "메인", "첫화면")),
            new Doc("auth", "로그인/회원가입", "/login, /register", "로그인과 회원가입을 통해 보호된 기능을 이용한다.", List.of("로그인", "회원가입", "가입", "계정", "로그아웃")),
            new Doc("ai_planner", "AI 플래너", "/ai", "체성분 분석, 4주 루틴 설계, AI 상담 기능이 있다.", List.of("ai", "플래너", "루틴", "체성분", "상담")),
            new Doc("ai_inbody", "인바디 분석", "/ai/inbody", "인바디 이미지/PDF 업로드 분석, 핵심 수치 확인 후 재상담, PDF 다운로드를 지원한다.", List.of("인바디", "pdf", "ocr", "체지방", "골격근")),
            new Doc("attendance", "출석", "/attendance", "출석 기록, 공유 링크 생성, 출석 관련 기능을 제공한다.", List.of("출석", "체크인", "공유", "attendance")),
            new Doc("rankings", "랭킹", "/rankings", "사용자 랭킹 및 순위 정보를 확인한다.", List.of("랭킹", "순위", "ranking")),
            new Doc("lounge", "라운지", "/lounge", "실시간 라운지 상호작용과 채팅 기능을 제공한다.", List.of("라운지", "실시간", "채팅", "lounge")),
            new Doc("events", "이벤트", "/events", "이벤트 목록과 상세 페이지를 제공한다.", List.of("이벤트", "행사", "event")),
            new Doc("crew", "운동 모임(크루)", "/crew", "크루 생성/참여, 챌린지 관리 기능이 있다.", List.of("크루", "모임", "챌린지", "crew")),
            new Doc("friends", "친구/채팅", "/friends", "친구 관리와 1:1 채팅 기능을 제공한다.", List.of("친구", "dm", "메시지", "채팅")),
            new Doc("brag", "자랑방", "/brag, /brag/write", "운동 기록 자랑 게시글 조회/작성/상세를 제공한다.", List.of("자랑", "자랑방", "게시글", "brag")),
            new Doc("protein", "단백질", "/protein, /reviews", "단백질 공동구매와 리뷰 기능을 제공한다.", List.of("단백질", "공구", "공동구매", "리뷰", "protein")),
            new Doc("programs", "반 추천/신청", "/programs", "프로그램/반 정보를 보고 신청할 수 있다.", List.of("프로그램", "반", "신청", "program")),
            new Doc("mypage", "마이페이지", "/mypage", "내 프로필 및 개인 데이터 확인 페이지다.", List.of("마이페이지", "내정보", "프로필", "mypage")),
            new Doc("gallery", "갤러리", "/gallery", "활동 사진과 미디어를 확인하는 페이지다.", List.of("갤러리", "사진", "미디어")),
            new Doc("about", "소개", "/about", "서비스 소개와 기본 안내를 제공한다.", List.of("소개", "about")),
            new Doc("members", "멤버/운영진", "/members, /executives", "멤버 및 운영진 소개 페이지다.", List.of("멤버", "운영진", "members", "executives"))
    );

    public String answer(String message, String page) {
        String query = normalize(message);
        if (query.isBlank()) {
            return BOT_NAME + " 등장. 질문 먼저 던져줘.\n예: \"인바디 분석 어디서 해?\"";
        }

        List<ScoredDoc> retrieved = retrieve(query, page);
        if (retrieved.isEmpty()) {
            return fallback(query, List.of(), page);
        }

        try {
            String systemPrompt = """
                    너는 '득근이'라는 이름의 홈페이지 안내 챗봇이다.
                    반드시 제공된 검색 문서(context)만 근거로 답변한다.
                    모르면 모른다고 말하고 추측하지 않는다.
                    답변 톤 규칙:
                    - 밝고 운동 커뮤니티 느낌의 말투를 사용한다.
                    - 반말/존댓말이 섞이지 않게 존댓말로 통일한다.
                    - 과장하지 말고 짧고 명확하게 말한다.
                    - 2~5문장으로 답한다.
                    - 마지막 줄에 관련 경로를 1~3개 제시한다.
                    """;

            String userPrompt = buildUserPrompt(query, page, retrieved);
            String aiAnswer = aiService.requestCompletion(systemPrompt, userPrompt);
            if (aiAnswer == null || aiAnswer.isBlank()) {
                return fallback(query, retrieved, page);
            }
            return aiAnswer;
        } catch (Exception ignored) {
            return fallback(query, retrieved, page);
        }
    }

    private String buildUserPrompt(String query, String page, List<ScoredDoc> retrieved) {
        StringBuilder context = new StringBuilder();
        for (int i = 0; i < retrieved.size(); i++) {
            ScoredDoc s = retrieved.get(i);
            context.append(i + 1)
                    .append(") title=").append(s.doc.title)
                    .append(", route=").append(s.doc.route)
                    .append(", summary=").append(s.doc.summary)
                    .append("\n");
        }

        return "사용자 질문: " + query + "\n"
                + "현재 페이지: " + (page == null || page.isBlank() ? "-" : page) + "\n"
                + "검색 문서:\n" + context
                + "요청: 질문에 맞게 한국어로 안내해줘.";
    }

    private List<ScoredDoc> retrieve(String query, String page) {
        Set<String> tokens = tokenize(query);
        List<ScoredDoc> scored = new ArrayList<>();
        String normalizedPage = normalize(page);

        for (Doc doc : docs) {
            int score = 0;
            String haystack = normalize(doc.title + " " + doc.route + " " + doc.summary + " " + String.join(" ", doc.keywords));

            for (String token : tokens) {
                if (token.length() < 2) {
                    continue;
                }
                if (normalize(doc.title).contains(token)) {
                    score += 5;
                }
                if (normalize(String.join(" ", doc.keywords)).contains(token)) {
                    score += 4;
                }
                if (normalize(doc.summary).contains(token)) {
                    score += 3;
                }
                if (normalize(doc.route).contains(token)) {
                    score += 3;
                }
                if (haystack.contains(token)) {
                    score += 1;
                }
            }

            if (!normalizedPage.isBlank() && normalize(doc.route).contains(normalizedPage)) {
                score += 2;
            }

            if (score > 0) {
                scored.add(new ScoredDoc(doc, score));
            }
        }

        scored.sort(Comparator.comparingInt(ScoredDoc::score).reversed());
        if (scored.isEmpty()) {
            return List.of();
        }
        return scored.subList(0, Math.min(TOP_K, scored.size()));
    }

    private String fallback(String query, List<ScoredDoc> retrieved, String page) {
        StringBuilder sb = new StringBuilder();
        if (retrieved.isEmpty()) {
            sb.append(BOT_NAME).append(": 딱 맞는 페이지를 아직 못 찾았어요.\n");
            sb.append("예: \"인바디 분석 어디서 해요?\", \"친구 채팅 어디서 해요?\"");
        } else {
            sb.append(BOT_NAME).append(": 관련 높은 페이지부터 바로 안내드릴게요.\n");
            for (int i = 0; i < Math.min(3, retrieved.size()); i++) {
                Doc d = retrieved.get(i).doc;
                sb.append("- ").append(d.title).append(": ").append(d.route).append("\n");
            }
        }
        if (page != null && !page.isBlank()) {
            sb.append("\n현재 페이지: ").append(page);
        }
        return sb.toString().trim();
    }

    private Set<String> tokenize(String text) {
        String normalized = normalize(text);
        String[] split = normalized.split("[^\\p{IsAlphabetic}\\p{IsDigit}]+");
        Set<String> tokens = new LinkedHashSet<>();
        for (String s : split) {
            if (!s.isBlank()) {
                tokens.add(s);
            }
        }
        tokens.add(normalized);
        return tokens;
    }

    private String normalize(String text) {
        return text == null ? "" : text.toLowerCase(Locale.ROOT).trim();
    }

    private record Doc(String id, String title, String route, String summary, List<String> keywords) {}

    private record ScoredDoc(Doc doc, int score) {}
}
