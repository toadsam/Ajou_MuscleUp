// src/main/java/com/ajou/muscleup/controller/HealthController.java
package com.ajou.muscleup.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {
  @GetMapping("/ping")
  public String ping() { return "pong"; }

  // 프론트에서 /api/ping으로 호출하는 경우도 대응
  @GetMapping("/api/ping")
  public String apiPing() { return "pong"; }
}
