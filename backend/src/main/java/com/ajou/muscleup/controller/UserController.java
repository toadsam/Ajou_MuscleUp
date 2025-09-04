package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.UserDTO;
import com.ajou.muscleup.dto.UserRegisterRequest;
import com.ajou.muscleup.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.util.UriComponentsBuilder;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    /** 회원가입 */
    @PostMapping("/register")
    public ResponseEntity<UserDTO> register(
            @Valid @RequestBody UserRegisterRequest req,
            UriComponentsBuilder uriBuilder
    ) {
        UserDTO created = userService.register(req);
        return ResponseEntity
                .created(uriBuilder.path("/api/users/{id}").buildAndExpand(created.getId()).toUri())
                .body(created); // 201 Created + 생성된 유저 정보
    }
}
