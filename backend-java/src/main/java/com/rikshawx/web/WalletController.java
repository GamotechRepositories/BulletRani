package com.rikshawx.web;

import com.rikshawx.security.JwtService;
import com.rikshawx.store.DataStore;
import com.rikshawx.store.Models.Tx;
import com.rikshawx.store.Models.User;
import io.jsonwebtoken.Claims;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/wallet")
public class WalletController {
  private final DataStore db;
  private final JwtService jwt;

  public WalletController(DataStore db, JwtService jwt) {
    this.db = db;
    this.jwt = jwt;
  }

  private long uid(String auth) {
    Claims c = jwt.fromAuthHeader(auth);
    return ((Number) c.get("id")).longValue();
  }

  @GetMapping("/balance")
  public ResponseEntity<?> balance(@RequestHeader("Authorization") String auth) {
    try {
      User u = db.findById(uid(auth));
      if (u == null) return ResponseEntity.status(404).body(Map.of("error", "User not found"));
      return ResponseEntity.ok(Map.of("balance", u.balance));
    } catch (Exception e) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }
  }

  @PostMapping("/deposit")
  public ResponseEntity<?> deposit(@RequestHeader("Authorization") String auth, @RequestBody Map<String, Object> body) {
    try {
      long id = uid(auth);
      double amount = Double.parseDouble(String.valueOf(body.get("amount")));
      String method = String.valueOf(body.getOrDefault("paymentMethod", "UPI / Card"));
      if (amount < 100 || amount > 100000) {
        return ResponseEntity.badRequest().body(Map.of("error", "Deposit amount must be between ₹100 and ₹1,00,000"));
      }
      User u = db.findById(id);
      double newBal = DataStore.round2(u.balance + amount);
      db.updateBalance(id, newBal);
      db.insertTx(id, "deposit", amount, newBal, "Deposit via " + method);
      return ResponseEntity.ok(Map.of("success", true, "balance", newBal,
          "message", "₹" + amount + " credited successfully!"));
    } catch (Exception e) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }
  }

  @PostMapping("/withdraw")
  public ResponseEntity<?> withdraw(@RequestHeader("Authorization") String auth, @RequestBody Map<String, Object> body) {
    try {
      long id = uid(auth);
      double amount = Double.parseDouble(String.valueOf(body.get("amount")));
      String bank = String.valueOf(body.getOrDefault("bankDetails", "Bank Account"));
      if (amount < 200) return ResponseEntity.badRequest().body(Map.of("error", "Minimum withdrawal is ₹200"));
      User u = db.findById(id);
      if (u.balance < amount) return ResponseEntity.badRequest().body(Map.of("error", "Insufficient funds"));
      double newBal = DataStore.round2(u.balance - amount);
      db.updateBalance(id, newBal);
      db.insertTx(id, "withdrawal", -amount, newBal, "Withdrawal to " + bank);
      return ResponseEntity.ok(Map.of("success", true, "balance", newBal,
          "message", "Withdrawal request for ₹" + amount + " processed!"));
    } catch (Exception e) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }
  }

  @GetMapping("/transactions")
  public ResponseEntity<?> transactions(@RequestHeader("Authorization") String auth) {
    try {
      List<Tx> txs = db.userTransactions(uid(auth));
      return ResponseEntity.ok(Map.of("transactions", txs));
    } catch (Exception e) {
      return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
    }
  }
}
