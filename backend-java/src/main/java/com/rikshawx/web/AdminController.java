package com.rikshawx.web;

import com.rikshawx.engine.CrashEngine;
import com.rikshawx.provider.ProviderWalletService;
import com.rikshawx.security.JwtService;
import com.rikshawx.store.DataStore;
import com.rikshawx.store.Models.User;
import io.jsonwebtoken.Claims;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
public class AdminController {
  private final DataStore db;
  private final JwtService jwt;
  private final CrashEngine engine;
  private final ProviderWalletService provider;

  public AdminController(DataStore db, JwtService jwt, CrashEngine engine, ProviderWalletService provider) {
    this.db = db;
    this.jwt = jwt;
    this.engine = engine;
    this.provider = provider;
  }

  private Claims requireAdmin(String auth) {
    Claims c = jwt.fromAuthHeader(auth);
    if (!"admin".equals(String.valueOf(c.get("role")))) {
      throw new SecurityException("Admin privilege required");
    }
    return c;
  }

  private ResponseEntity<?> deny(Exception e) {
    if (e instanceof SecurityException) return ResponseEntity.status(403).body(Map.of("error", e.getMessage()));
    return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
  }

  @GetMapping("/stats")
  public ResponseEntity<?> stats(@RequestHeader("Authorization") String auth) {
    try {
      requireAdmin(auth);
      double volume = db.sumVolumeReal();
      double payout = db.sumPayoutsReal();
      double ggr = DataStore.round2(volume - payout);
      double rtp = volume > 0 ? DataStore.round2((payout / volume) * 100) : 0;
      Map<String, Object> m = new LinkedHashMap<>();
      m.put("totalUsers", db.countPlayers());
      m.put("totalVolume", volume);
      m.put("totalPayout", payout);
      m.put("grossGamingRevenue", ggr);
      m.put("actualRTP", rtp);
      m.put("configuredHouseEdge", db.getSetting("house_edge", "3.0"));
      m.put("totalRounds", db.countCompletedRounds());
      return ResponseEntity.ok(m);
    } catch (Exception e) { return deny(e); }
  }

  @GetMapping("/engine")
  public ResponseEntity<?> engine(@RequestHeader("Authorization") String auth) {
    try {
      requireAdmin(auth);
      return ResponseEntity.ok(Map.of("success", true, "engine", engine.getAdminEngineState()));
    } catch (Exception e) { return deny(e); }
  }

  @GetMapping("/users")
  public ResponseEntity<?> users(@RequestHeader("Authorization") String auth) {
    try {
      requireAdmin(auth);
      List<Map<String, Object>> users = db.listUsers().stream().map(u -> {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.id); m.put("username", u.username); m.put("email", u.email);
        m.put("balance", u.balance); m.put("role", u.role); m.put("is_banned", u.isBanned);
        m.put("created_at", u.createdAt);
        return m;
      }).collect(Collectors.toList());
      return ResponseEntity.ok(Map.of("users", users));
    } catch (Exception e) { return deny(e); }
  }

  @PostMapping("/create-user")
  public ResponseEntity<?> createUser(@RequestHeader("Authorization") String auth, @RequestBody Map<String, Object> body) {
    try {
      requireAdmin(auth);
      String username = String.valueOf(body.get("username"));
      String email = String.valueOf(body.get("email"));
      String password = String.valueOf(body.get("password"));
      String role = "admin".equals(body.get("role")) ? "admin" : "player";
      double balance = body.get("balance") == null ? 5000 : Double.parseDouble(String.valueOf(body.get("balance")));
      if (db.existsUsernameOrEmail(username, email)) {
        return ResponseEntity.badRequest().body(Map.of("error", "Username or email already in use"));
      }
      User u = db.createUser(username, email, password, balance, role);
      Map<String, Object> user = new LinkedHashMap<>();
      user.put("id", u.id); user.put("username", u.username); user.put("email", u.email);
      user.put("balance", u.balance); user.put("role", u.role);
      return ResponseEntity.ok(Map.of("success", true, "user", user));
    } catch (Exception e) { return deny(e); }
  }

  @PostMapping("/set-role")
  public ResponseEntity<?> setRole(@RequestHeader("Authorization") String auth, @RequestBody Map<String, Object> body) {
    try {
      Claims admin = requireAdmin(auth);
      long userId = Long.parseLong(String.valueOf(body.get("userId")));
      String role = String.valueOf(body.get("role"));
      if (!List.of("admin", "player").contains(role)) {
        return ResponseEntity.badRequest().body(Map.of("error", "Role must be admin or player"));
      }
      if (userId == ((Number) admin.get("id")).longValue() && !"admin".equals(role)) {
        return ResponseEntity.badRequest().body(Map.of("error", "Cannot demote your own admin account"));
      }
      if (db.findById(userId) == null) return ResponseEntity.status(404).body(Map.of("error", "User not found"));
      db.setRole(userId, role);
      return ResponseEntity.ok(Map.of("success", true, "role", role));
    } catch (Exception e) { return deny(e); }
  }

  @PostMapping("/reset-password")
  public ResponseEntity<?> resetPassword(@RequestHeader("Authorization") String auth, @RequestBody Map<String, Object> body) {
    try {
      requireAdmin(auth);
      long userId = Long.parseLong(String.valueOf(body.get("userId")));
      String pw = String.valueOf(body.get("newPassword"));
      if (pw.length() < 4) return ResponseEntity.badRequest().body(Map.of("error", "Password must be at least 4 characters"));
      if (db.findById(userId) == null) return ResponseEntity.status(404).body(Map.of("error", "User not found"));
      db.setPassword(userId, pw);
      return ResponseEntity.ok(Map.of("success", true, "message", "Password reset"));
    } catch (Exception e) { return deny(e); }
  }

  @PostMapping("/adjust-balance")
  public ResponseEntity<?> adjustBalance(@RequestHeader("Authorization") String auth, @RequestBody Map<String, Object> body) {
    try {
      requireAdmin(auth);
      long userId = Long.parseLong(String.valueOf(body.get("userId")));
      double change = Double.parseDouble(String.valueOf(body.get("amount")));
      String reason = String.valueOf(body.getOrDefault("reason", "Admin Manual Adjustment"));
      User u = db.findById(userId);
      if (u == null) return ResponseEntity.status(404).body(Map.of("error", "User not found"));
      double newBal = Math.max(0, DataStore.round2(u.balance + change));
      db.updateBalance(userId, newBal);
      db.insertTx(userId, "admin_adj", change, newBal, reason);
      return ResponseEntity.ok(Map.of("success", true, "newBalance", newBal));
    } catch (Exception e) { return deny(e); }
  }

  @PostMapping("/toggle-ban")
  public ResponseEntity<?> toggleBan(@RequestHeader("Authorization") String auth, @RequestBody Map<String, Object> body) {
    try {
      Claims admin = requireAdmin(auth);
      long userId = Long.parseLong(String.valueOf(body.get("userId")));
      if (userId == ((Number) admin.get("id")).longValue()) {
        return ResponseEntity.badRequest().body(Map.of("error", "Cannot ban your own admin account"));
      }
      User u = db.findById(userId);
      if (u == null) return ResponseEntity.status(404).body(Map.of("error", "User not found"));
      int next = u.isBanned != 0 ? 0 : 1;
      db.setBanned(userId, next);
      return ResponseEntity.ok(Map.of("success", true, "is_banned", next));
    } catch (Exception e) { return deny(e); }
  }

  @GetMapping("/settings")
  public ResponseEntity<?> getSettings(@RequestHeader("Authorization") String auth) {
    try {
      requireAdmin(auth);
      return ResponseEntity.ok(Map.of("settings", db.allSettings()));
    } catch (Exception e) { return deny(e); }
  }

  @PostMapping("/settings")
  public ResponseEntity<?> saveSettings(@RequestHeader("Authorization") String auth, @RequestBody Map<String, Object> body) {
    try {
      requireAdmin(auth);
      db.putSettings(body);
      return ResponseEntity.ok(Map.of("success", true, "message", "Settings saved"));
    } catch (Exception e) { return deny(e); }
  }

  @GetMapping("/transactions")
  public ResponseEntity<?> transactions(@RequestHeader("Authorization") String auth,
                                        @RequestParam(defaultValue = "100") int limit) {
    try {
      requireAdmin(auth);
      return ResponseEntity.ok(Map.of("transactions", db.listTransactions(Math.min(limit, 200))));
    } catch (Exception e) { return deny(e); }
  }

  @PostMapping("/force-crash")
  public ResponseEntity<?> forceCrash(@RequestHeader("Authorization") String auth, @RequestBody(required = false) Map<String, Object> body) {
    try {
      requireAdmin(auth);
      Double at = body != null && body.get("atMultiplier") != null ? Double.parseDouble(String.valueOf(body.get("atMultiplier"))) : null;
      Map<String, Object> r = engine.forceCrash(at);
      return Boolean.TRUE.equals(r.get("success")) ? ResponseEntity.ok(r) : ResponseEntity.badRequest().body(r);
    } catch (Exception e) { return deny(e); }
  }

  @PostMapping("/force-start")
  public ResponseEntity<?> forceStart(@RequestHeader("Authorization") String auth) {
    try {
      requireAdmin(auth);
      Map<String, Object> r = engine.forceStart();
      return Boolean.TRUE.equals(r.get("success")) ? ResponseEntity.ok(r) : ResponseEntity.badRequest().body(r);
    } catch (Exception e) { return deny(e); }
  }

  @PostMapping("/pause")
  public ResponseEntity<?> pause(@RequestHeader("Authorization") String auth) {
    try { requireAdmin(auth); return ResponseEntity.ok(engine.pauseGame()); }
    catch (Exception e) { return deny(e); }
  }

  @PostMapping("/resume")
  public ResponseEntity<?> resume(@RequestHeader("Authorization") String auth) {
    try { requireAdmin(auth); return ResponseEntity.ok(engine.resumeGame()); }
    catch (Exception e) { return deny(e); }
  }

  @PostMapping("/set-next-crash")
  public ResponseEntity<?> setNext(@RequestHeader("Authorization") String auth, @RequestBody Map<String, Object> body) {
    try {
      requireAdmin(auth);
      Map<String, Object> r = engine.setNextCrashOverride(Double.parseDouble(String.valueOf(body.get("multiplier"))));
      return Boolean.TRUE.equals(r.get("success")) ? ResponseEntity.ok(r) : ResponseEntity.badRequest().body(r);
    } catch (Exception e) { return deny(e); }
  }

  @PostMapping("/set-crash-target")
  public ResponseEntity<?> setTarget(@RequestHeader("Authorization") String auth, @RequestBody Map<String, Object> body) {
    try {
      requireAdmin(auth);
      Map<String, Object> r = engine.setCurrentCrashTarget(Double.parseDouble(String.valueOf(body.get("multiplier"))));
      return Boolean.TRUE.equals(r.get("success")) ? ResponseEntity.ok(r) : ResponseEntity.badRequest().body(r);
    } catch (Exception e) { return deny(e); }
  }

  @PostMapping("/clear-overrides")
  public ResponseEntity<?> clear(@RequestHeader("Authorization") String auth) {
    try { requireAdmin(auth); return ResponseEntity.ok(engine.clearCrashOverrides()); }
    catch (Exception e) { return deny(e); }
  }

  @GetMapping("/provider")
  public ResponseEntity<?> getProvider(@RequestHeader("Authorization") String auth) {
    try {
      requireAdmin(auth);
      return ResponseEntity.ok(Map.of("success", true, "provider", provider.getPublicConfig()));
    } catch (Exception e) { return deny(e); }
  }

  @PutMapping("/provider")
  public ResponseEntity<?> saveProvider(@RequestHeader("Authorization") String auth,
                                        @RequestBody Map<String, Object> body) {
    try {
      requireAdmin(auth);
      Map<String, Object> cfg = provider.updateConfig(body);
      return ResponseEntity.ok(Map.of(
          "success", true,
          "message", "Provider settings saved",
          "provider", cfg
      ));
    } catch (Exception e) { return deny(e); }
  }

  /** Support: look up player profile for a live sessionToken via Provider wallet API. */
  @PostMapping("/provider/session-lookup")
  public ResponseEntity<?> providerSessionLookup(@RequestHeader("Authorization") String auth,
                                                 @RequestBody Map<String, String> body) {
    try {
      requireAdmin(auth);
      if (!provider.isEnabled()) {
        return ResponseEntity.badRequest().body(Map.of(
            "success", false,
            "error", "Provider wallet is disabled — enable it first"
        ));
      }
      String token = body.get("sessionToken");
      if (token == null || token.isBlank()) {
        return ResponseEntity.badRequest().body(Map.of("success", false, "error", "sessionToken required"));
      }
      Double balance = provider.getBalance(token);
      Map<String, Object> profile = provider.getPlayerProfile(token);
      Map<String, Object> out = new LinkedHashMap<>();
      out.put("success", true);
      out.put("balance", balance);
      out.put("profile", profile);
      return ResponseEntity.ok(out);
    } catch (Exception e) {
      return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
    }
  }
}
