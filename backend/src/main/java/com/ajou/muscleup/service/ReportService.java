package com.ajou.muscleup.service;

import com.ajou.muscleup.entity.BragComment;
import com.ajou.muscleup.entity.BragPost;
import com.ajou.muscleup.entity.ContentReport;
import com.ajou.muscleup.entity.GymGuestbookEntry;
import com.ajou.muscleup.entity.Protein;
import com.ajou.muscleup.entity.ReportReason;
import com.ajou.muscleup.entity.ReportStatus;
import com.ajou.muscleup.entity.ReportTargetType;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.BragCommentRepository;
import com.ajou.muscleup.repository.BragPostRepository;
import com.ajou.muscleup.repository.ContentReportRepository;
import com.ajou.muscleup.repository.GymGuestbookRepository;
import com.ajou.muscleup.repository.ProteinRepository;
import com.ajou.muscleup.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * 신고(이용약관 제10조 1항). 이용자는 볼 수 있는 대상만 신고할 수 있고, 같은 대상은 한 번만.
 * 운영자는 확인 후 "조치(ACTIONED, 필요하면 게시물 삭제)" 또는 "문제없음(DISMISSED)"으로 닫는다.
 * 같은 대상에 열린 신고가 여럿이면 함께 닫는다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReportService {
    private static final int DAILY_LIMIT = 30;
    private static final int SNAPSHOT_MAX = 500;

    private final ContentReportRepository reportRepository;
    private final BragPostRepository bragPostRepository;
    private final BragCommentRepository bragCommentRepository;
    private final ProteinRepository proteinRepository;
    private final UserRepository userRepository;
    private final BragAccess bragAccess;
    private final GroupBuyAccess groupBuyAccess;
    private final GymGuestbookRepository guestbookRepository;
    private final FriendService friendService;
    private final Clock clock;

    @PersistenceContext
    private EntityManager em;

    /** 신고 대상의 작성자와 신고 순간의 내용 */
    private record Target(User author, String snapshot) {}

    @Transactional
    public ContentReport create(User reporter, ReportTargetType type, Long targetId, ReportReason reason, String detail) {
        if (type == null || targetId == null || reason == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "무엇을 왜 신고하는지 골라 주세요.");
        }
        if (reportRepository.existsByReporter_IdAndTargetTypeAndTargetId(reporter.getId(), type, targetId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 신고했어요. 운영진이 확인하고 있어요.");
        }
        if (reportRepository.countByReporter_IdAndCreatedAtAfter(reporter.getId(), LocalDateTime.now(clock).minusDays(1)) >= DAILY_LIMIT) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "오늘은 더 신고할 수 없어요. 내일 다시 시도해 주세요.");
        }
        Target target = resolve(reporter, type, targetId);
        if (target.author() != null && Objects.equals(target.author().getId(), reporter.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "내 글은 신고할 수 없어요.");
        }
        ContentReport saved = reportRepository.save(ContentReport.builder()
                .reporter(reporter)
                .targetType(type)
                .targetId(targetId)
                .targetUser(target.author())
                .reason(reason)
                .detail(trim(detail, 500))
                .snapshot(trim(target.snapshot(), SNAPSHOT_MAX))
                .status(ReportStatus.OPEN)
                .build());
        log.info("신고 접수: id={} type={} targetId={}", saved.getId(), type, targetId);
        return saved;
    }

    private Target resolve(User reporter, ReportTargetType type, Long id) {
        return switch (type) {
            case BRAG_POST -> {
                BragPost p = bragPostRepository.findById(id).orElseThrow(this::notFound);
                if (!bragAccess.canView(p, reporter)) throw notFound();
                yield new Target(p.getUser(), p.getTitle() + "\n" + p.getContent());
            }
            case BRAG_COMMENT -> {
                BragComment c = bragCommentRepository.findById(id).orElseThrow(this::notFound);
                if (!bragAccess.canView(c.getBragPost(), reporter)) throw notFound();
                yield new Target(c.getUser(), c.getContent());
            }
            case PROTEIN -> {
                Protein p = proteinRepository.findById(id).orElseThrow(this::notFound);
                if (!groupBuyAccess.canView(p, reporter)) throw notFound();
                yield new Target(p.getOwner(), p.getName() + (p.getDescription() != null ? "\n" + p.getDescription() : ""));
            }
            case USER -> {
                User u = userRepository.findById(id).orElseThrow(this::notFound);
                yield new Target(u, "닉네임: " + u.getNickname());
            }
            case GYM_GUESTBOOK -> {
                // 볼 수 있는 사람(헬스장 주인 · 주인의 친구)만
                GymGuestbookEntry e = guestbookRepository.findById(id).orElseThrow(this::notFound);
                Long ownerId = e.getOwner().getId();
                if (!ownerId.equals(reporter.getId()) && !friendService.areFriends(reporter.getId(), ownerId)) throw notFound();
                yield new Target(e.getAuthor(), "방명록(" + e.getOwner().getNickname() + "의 헬스장): " + e.getMessage());
            }
        };
    }

    @Transactional(readOnly = true)
    public Page<ContentReport> list(ReportStatus status, Pageable pageable) {
        return status == null
                ? reportRepository.findAllByOrderByCreatedAtDesc(pageable)
                : reportRepository.findAllByStatusOrderByCreatedAtDesc(status, pageable);
    }

    /** 운영자 처리. deleteContent 면 대상 게시물을 지운다(사용자 신고는 지울 게시물이 없음) */
    @Transactional
    public ContentReport resolve(Long reportId, ReportStatus status, boolean deleteContent, String note) {
        if (status == null || status == ReportStatus.OPEN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "조치함 또는 문제없음으로 골라 주세요.");
        }
        ContentReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "신고를 찾을 수 없어요."));
        if (status == ReportStatus.ACTIONED && deleteContent) {
            deleteTarget(report.getTargetType(), report.getTargetId());
        }
        LocalDateTime now = LocalDateTime.now(clock);
        for (ContentReport r : reportRepository.findAllByTargetTypeAndTargetIdAndStatus(
                report.getTargetType(), report.getTargetId(), ReportStatus.OPEN)) {
            r.setStatus(status);
            r.setAdminNote(trim(note, 500));
            r.setHandledAt(now);
        }
        report.setStatus(status);
        report.setAdminNote(trim(note, 500));
        report.setHandledAt(now);
        return report;
    }

    private void deleteTarget(ReportTargetType type, Long id) {
        switch (type) {
            case BRAG_POST -> bragPostRepository.findById(id).ifPresent(p -> {
                em.createQuery("delete from BragComment c where c.bragPost.id = :id").setParameter("id", id).executeUpdate();
                em.createQuery("delete from BragLike l where l.bragPost.id = :id").setParameter("id", id).executeUpdate();
                bragPostRepository.delete(p);
            });
            case BRAG_COMMENT -> bragCommentRepository.findById(id).ifPresent(bragCommentRepository::delete);
            case PROTEIN -> proteinRepository.findById(id).ifPresent(p -> {
                em.createQuery("delete from ProteinShareMessage m where m.protein.id = :id").setParameter("id", id).executeUpdate();
                em.createQuery("delete from ProteinShareApplication a where a.protein.id = :id").setParameter("id", id).executeUpdate();
                em.createQuery("delete from Review r where r.protein.id = :id").setParameter("id", id).executeUpdate();
                proteinRepository.delete(p);
            });
            case USER -> {
                // 사용자 신고: 지울 게시물이 없다. 이용 정지는 아직 없음(남은 일)
            }
            case GYM_GUESTBOOK -> guestbookRepository.findById(id).ifPresent(guestbookRepository::delete);
        }
    }

    private ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "신고할 대상을 찾을 수 없어요.");
    }

    private static String trim(String v, int max) {
        if (v == null) return null;
        String t = v.trim();
        if (t.isEmpty()) return null;
        return t.length() <= max ? t : t.substring(0, max);
    }
}
