// src/main/java/com/ajou/muscleup/controller/UserController.java
package com.ajou.muscleup.controller;

import com.ajou.muscleup.dto.UserDTO;
import com.ajou.muscleup.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;

    @PostMapping("/register")
    public UserDTO register(@RequestParam String name,
                            @RequestParam String email,
                            @RequestParam String password) {
        return userService.registerUser(name, email, password);
    }
}
