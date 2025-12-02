package com.ajou.muscleup.dto.program;

import com.ajou.muscleup.entity.ApplicationStatus;
import com.ajou.muscleup.entity.ProgramApplication;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class ApplicationResponse {
    private Long id;
    private String name;
    private String email;
    private String goal;
    private String track;
    private String commitment;
    private ApplicationStatus status;
    private LocalDateTime createdAt;

    public static ApplicationResponse from(ProgramApplication a) {
        return new ApplicationResponse(
                a.getId(),
                a.getName(),
                a.getEmail(),
                a.getGoal(),
                a.getTrack(),
                a.getCommitment(),
                a.getStatus(),
                a.getCreatedAt()
        );
    }
}
