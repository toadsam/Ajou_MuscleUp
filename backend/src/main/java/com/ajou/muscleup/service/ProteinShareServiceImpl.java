package com.ajou.muscleup.service;

import com.ajou.muscleup.dto.protein.ProteinShareApplicationResponse;
import com.ajou.muscleup.dto.protein.ProteinShareMessageResponse;
import com.ajou.muscleup.dto.protein.ProteinShareSummaryResponse;
import com.ajou.muscleup.entity.Protein;
import com.ajou.muscleup.entity.ProteinShareApplication;
import com.ajou.muscleup.entity.ProteinShareMessage;
import com.ajou.muscleup.entity.ProteinShareStatus;
import com.ajou.muscleup.entity.User;
import com.ajou.muscleup.repository.ProteinRepository;
import com.ajou.muscleup.repository.ProteinShareApplicationRepository;
import com.ajou.muscleup.repository.ProteinShareMessageRepository;
import com.ajou.muscleup.repository.UserRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Transactional
public class ProteinShareServiceImpl implements ProteinShareService {
    private final ProteinRepository proteinRepository;
    private final ProteinShareApplicationRepository applicationRepository;
    private final ProteinShareMessageRepository messageRepository;
    private final UserRepository userRepository;

    @Override
    public ProteinShareApplicationResponse apply(Long proteinId, String email) {
        User user = getUser(email);
        Protein protein = getProtein(proteinId);
        ProteinShareApplication existing = applicationRepository
                .findByProteinIdAndUserId(proteinId, user.getId())
                .orElse(null);
        if (existing != null) {
            return ProteinShareApplicationResponse.from(existing);
        }
        ProteinShareApplication created = applicationRepository.save(
                ProteinShareApplication.builder()
                        .protein(protein)
                        .user(user)
                        .status(ProteinShareStatus.PENDING)
                        .build()
        );
        return ProteinShareApplicationResponse.from(created);
    }

    @Override
    @Transactional(readOnly = true)
    public ProteinShareApplicationResponse getMyApplication(Long proteinId, String email) {
        User user = getUser(email);
        return applicationRepository.findByProteinIdAndUserId(proteinId, user.getId())
                .map(ProteinShareApplicationResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found"));
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProteinShareApplicationResponse> listApplications(Long proteinId, String email) {
        User user = getUser(email);
        Protein protein = getProtein(proteinId);
        ensureOwnerOrAdmin(protein, user);
        return applicationRepository.findByProteinIdOrderByCreatedAtDesc(proteinId)
                .stream()
                .map(ProteinShareApplicationResponse::from)
                .toList();
    }

    @Override
    public ProteinShareApplicationResponse updateStatus(Long proteinId, Long appId, ProteinShareStatus status, String email) {
        User user = getUser(email);
        Protein protein = getProtein(proteinId);
        ensureOwnerOrAdmin(protein, user);
        ProteinShareApplication application = applicationRepository.findById(appId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found"));
        if (!application.getProtein().getId().equals(proteinId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid protein application");
        }
        application.setStatus(status);
        return ProteinShareApplicationResponse.from(application);
    }

    @Override
    @Transactional(readOnly = true)
    public ProteinShareSummaryResponse getSummary(Long proteinId) {
        getProtein(proteinId);
        long pending = applicationRepository.countByProteinIdAndStatus(proteinId, ProteinShareStatus.PENDING);
        long approved = applicationRepository.countByProteinIdAndStatus(proteinId, ProteinShareStatus.APPROVED);
        return new ProteinShareSummaryResponse(pending, approved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProteinShareMessageResponse> listMessages(Long proteinId, String email) {
        User user = getUser(email);
        Protein protein = getProtein(proteinId);
        ensureChatAccess(protein, user);
        return messageRepository.findByProteinIdOrderByCreatedAtAsc(proteinId)
                .stream()
                .map(ProteinShareMessageResponse::from)
                .toList();
    }

    @Override
    public ProteinShareMessageResponse postMessage(Long proteinId, String email, String content) {
        User user = getUser(email);
        Protein protein = getProtein(proteinId);
        ensureChatAccess(protein, user);
        ProteinShareMessage saved = messageRepository.save(
                ProteinShareMessage.builder()
                        .protein(protein)
                        .user(user)
                        .content(content)
                        .build()
        );
        return ProteinShareMessageResponse.from(saved);
    }

    private void ensureChatAccess(Protein protein, User user) {
        if (isAdmin(user) || isOwner(protein, user)) {
            return;
        }
        ProteinShareApplication application = applicationRepository
                .findByProteinIdAndUserId(protein.getId(), user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Not approved"));
        if (application.getStatus() != ProteinShareStatus.APPROVED) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not approved");
        }
    }

    private void ensureOwnerOrAdmin(Protein protein, User user) {
        if (isAdmin(user)) {
            return;
        }
        if (!isOwner(protein, user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not owner");
        }
    }

    private boolean isOwner(Protein protein, User user) {
        return protein.getOwner() != null && protein.getOwner().getId().equals(user.getId());
    }

    private boolean isAdmin(User user) {
        return user.getRole() != null && user.getRole().contains("ADMIN");
    }

    private User getUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }

    private Protein getProtein(Long proteinId) {
        return proteinRepository.findById(proteinId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Protein not found"));
    }
}
