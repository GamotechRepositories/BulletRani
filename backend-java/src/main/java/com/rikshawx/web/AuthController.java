package com.rikshawx.web;

import com.rikshawx.security.JwtService;
import com.rikshawx.store.DataStore;
import com.rikshawx.store.Models.User;
import io.jsonwebtoken.Claims;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final DataStore db;
  private final JwtService jwt;

  public AuthController(DataStore db, JwtService jwt) {
    this.db = db;
    this.jwt = jwt;
  }

  @PostMapping("/register")
  public ResponseEntity<?> register(@RequestBody Map<String, String> body) {
    String username = body.get("username");
    String email = body.get("email");
    String password = body.get("password");
    if (username == null || email == null || password == null) {
      return ResponseEntity.badRequest().body(Map.of("error", "All fields are required"));
    }
    if (db.existsUsernameOrEmail(username, email)) {
      return ResponseEntity.badRequest().body(Map.of("error", "Username or email already in use"));
    }
    User user = db.createUser(username, email, password, 5000, "player");
    String token = jwt.issue(user);
    return ResponseEntity.ok(Map.of("success", true, "token", token, "user", publicUser(user)));
  }

  @PostMapping("/login")
  public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
    String login = body.get("login");
    String password = body.get("password");
    if (login == null || password == null) {
      return ResponseEntity.badRequest().body(Map.of("error", "Login and password required"));
    }
    User user = db.findByLogin(login);
    if (user == null || !db.bcrypt().matches(password, user.passwordHash)) {
      return ResponseEntity.status(401).body(Map.of("error", "Invalid credentials"));
    }
    if (user.isBanned != 0) {
      return ResponseEntity.status(403).body(Map.of("error", "Account suspended. Contact support."));
    }
    return ResponseEntity.ok(Map.of("success", true, "token", jwt.issue(user), "user", publicUser(user)));
  }

  @GetMapping("/me")
  public ResponseEntity<?> me(@RequestHeader(value = "Authorization", required = false) String auth) {
    try {
      Claims claims = jwt.fromAuthHeader(auth);
      long id = ((Number) claims.get("id")).longValue();
      User user = db.findById(id);
      if (user == null) return ResponseEntity.status(404).body(Map.of("error", "User not found"));
      Map<String, Object> u = publicUser(user);
      u.put("created_at", user.createdAt);
      return ResponseEntity.ok(Map.of("user", u));
    } catch (Exception e) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }
  }

  private Map<String, Object> publicUser(User user) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", user.id);
    m.put("username", user.username);
    m.put("email", user.email);
    m.put("balance", user.balance);
    m.put("role", user.role);
    return m;
  }
}
