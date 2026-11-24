package com.rikshawx.store;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.rikshawx.config.AppProperties;
import com.rikshawx.store.Models.*;
import jakarta.annotation.PostConstruct;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Component
public class DataStore {
  private final Path storePath;
  private final ObjectMapper mapper = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);
  private final BCryptPasswordEncoder bcrypt = new BCryptPasswordEncoder(10);
  private StoreData data = new StoreData();

  public DataStore(AppProperties props) {
    this.storePath = Path.of(props.getStorePath()).toAbsolutePath().normalize();
  }

  @PostConstruct
  public synchronized void init() {
    try {
      Files.createDirectories(storePath.getParent());
      if (Files.exists(storePath)) {
        data = mapper.readValue(storePath.toFile(), StoreData.class);
        if (data.users == null) data.users = new ArrayList<>();
        if (data.gameRounds == null) data.gameRounds = new ArrayList<>();
        if (data.bets == null) data.bets = new ArrayList<>();
        if (data.transactions == null) data.transactions = new ArrayList<>();
        if (data.systemSettings == null) data.systemSettings = new LinkedHashMap<>();
        if (data.nextId == null) data.nextId = new LinkedHashMap<>();
      }
      seedDefaults();
    } catch (Exception e) {
      throw new IllegalStateException("Failed to load store: " + storePath, e);
    }
  }

  private void seedDefaults() throws IOException {
    data.systemSettings.putIfAbsent("house_edge", "3.0");
    data.systemSettings.putIfAbsent("min_bet", "10.0");
    data.systemSettings.putIfAbsent("max_bet", "10000.0");
    data.systemSettings.putIfAbsent("max_payout", "1000000.0");
    data.systemSettings.putIfAbsent("countdown_seconds", "5.0");
    data.systemSettings.putIfAbsent("currency_symbol", "₹");
    data.nextId.putIfAbsent("users", 1L);
    data.nextId.putIfAbsent("game_rounds", 1L);
    data.nextId.putIfAbsent("bets", 1L);
    data.nextId.putIfAbsent("transactions", 1L);

    if (data.users.isEmpty()) {
      createUserInternal("SuperAdmin", "admin@aviator.local", "admin123", 100000, "admin");
      createUserInternal("TopGunPilot", "pilot@aviator.local", "pilot123", 5000, "player");
      createUserInternal("LuckySky77", "sky77@aviator.local", "pilot123", 8200, "player");
    }
    save();
  }

  private synchronized void save() {
    try {
      Path tmp = Path.of(storePath + ".tmp");
      mapper.writeValue(tmp.toFile(), data);
      Files.move(tmp, storePath, java.nio.file.StandardCopyOption.REPLACE_EXISTING, java.nio.file.StandardCopyOption.ATOMIC_MOVE);
    } catch (Exception e) {
      try {
        mapper.writeValue(storePath.toFile(), data);
      } catch (IOException ex) {
        throw new IllegalStateException("Failed to persist store", ex);
      }
    }
  }

  public BCryptPasswordEncoder bcrypt() { return bcrypt; }

  public synchronized User findByLogin(String login) {
    String q = login.trim();
    String ql = q.toLowerCase(Locale.ROOT);
    return data.users.stream()
        .filter(u -> u.username.equalsIgnoreCase(q) || u.email.equalsIgnoreCase(ql))
        .findFirst().orElse(null);
  }

  public synchronized User findById(long id) {
    return data.users.stream().filter(u -> u.id == id).findFirst().orElse(null);
  }

  public synchronized boolean existsUsernameOrEmail(String username, String email) {
    return data.users.stream().anyMatch(u ->
        u.username.equalsIgnoreCase(username) || u.email.equalsIgnoreCase(email));
  }

  public synchronized User createUser(String username, String email, String password, double balance, String role) {
    User u = createUserInternal(username, email, password, balance, role);
    save();
    return u;
  }

  private User createUserInternal(String username, String email, String password, double balance, String role) {
    User u = new User();
    u.id = next("users");
    u.username = username.trim();
    u.email = email.trim().toLowerCase(Locale.ROOT);
    u.passwordHash = bcrypt.encode(password);
    u.balance = balance;
    u.role = role;
    u.isBanned = 0;
    u.createdAt = Instant.now().toString();
    data.users.add(u);
    return u;
  }

  public synchronized void updateBalance(long userId, double balance) {
    User u = findById(userId);
    if (u != null) { u.balance = round2(balance); save(); }
  }

  public synchronized void setBanned(long userId, int banned) {
    User u = findById(userId);
    if (u != null) { u.isBanned = banned; save(); }
  }

  public synchronized void setRole(long userId, String role) {
    User u = findById(userId);
    if (u != null) { u.role = role; save(); }
  }

  public synchronized void setPassword(long userId, String raw) {
    User u = findById(userId);
    if (u != null) { u.passwordHash = bcrypt.encode(raw); save(); }
  }

  public synchronized List<User> listUsers() {
    List<User> copy = new ArrayList<>(data.users);
    Collections.reverse(copy);
    return copy;
  }

  public synchronized long countPlayers() {
    return data.users.stream().filter(u -> "player".equals(u.role)).count();
  }

  public synchronized String getSetting(String key, String fallback) {
    return data.systemSettings.getOrDefault(key, fallback);
  }

  public synchronized double getSettingDouble(String key, double fallback) {
    try { return Double.parseDouble(getSetting(key, String.valueOf(fallback))); }
    catch (Exception e) { return fallback; }
  }

  public synchronized Map<String, String> allSettings() {
    return new LinkedHashMap<>(data.systemSettings);
  }

  public synchronized void putSettings(Map<String, ?> updates) {
    updates.forEach((k, v) -> data.systemSettings.put(k, String.valueOf(v)));
    save();
  }

  public synchronized long maxRoundNumber() {
    return data.gameRounds.stream().mapToLong(r -> r.roundNumber).max().orElse(1000);
  }

  public synchronized GameRound insertRound(long roundNumber, String serverSeed, String clientSeed,
                                            String hash, String seedHash, long nonce, String chainHash,
                                            double crashMultiplier) {
    GameRound r = new GameRound();
    r.id = next("game_rounds");
    r.roundNumber = roundNumber;
    r.serverSeed = serverSeed;
    r.clientSeed = clientSeed;
    r.hash = hash;
    r.seedHash = seedHash;
    r.nonce = nonce;
    r.chainHash = chainHash;
    r.crashMultiplier = crashMultiplier;
    r.status = "waiting";
    r.startedAt = Instant.now().toString();
    data.gameRounds.add(r);
    save();
    return r;
  }

  public synchronized void setRoundInProgress(long id) {
    data.gameRounds.stream().filter(r -> r.id == id).findFirst().ifPresent(r -> {
      r.status = "in_progress";
      save();
    });
  }

  public synchronized void completeRound(long id, double crashMultiplier) {
    data.gameRounds.stream().filter(r -> r.id == id).findFirst().ifPresent(r -> {
      r.status = "completed";
      r.crashMultiplier = crashMultiplier;
      r.crashedAt = Instant.now().toString();
      save();
    });
  }

  public synchronized List<GameRound> recentCompleted(int limit) {
    List<GameRound> list = data.gameRounds.stream()
        .filter(r -> "completed".equals(r.status))
        .collect(Collectors.toCollection(ArrayList::new));
    Collections.reverse(list);
    return list.stream().limit(limit).collect(Collectors.toList());
  }

  public synchronized String lastChainHash() {
    for (int i = data.gameRounds.size() - 1; i >= 0; i--) {
      GameRound r = data.gameRounds.get(i);
      if ("completed".equals(r.status) && r.chainHash != null) return r.chainHash;
    }
    return "GENESIS";
  }

  public synchronized Bet insertBet(long roundId, long userId, int panelId, double amount, Double autoCashout) {
    Bet b = new Bet();
    b.id = next("bets");
    b.roundId = roundId;
    b.userId = userId;
    b.panelId = panelId;
    b.betAmount = amount;
    b.autoCashout = autoCashout;
    b.cashoutMultiplier = null;
    b.winAmount = 0;
    b.status = "active";
    b.createdAt = Instant.now().toString();
    data.bets.add(b);
    save();
    return b;
  }

  public synchronized void cashoutBetDb(long betId, double mult, double win) {
    data.bets.stream().filter(b -> b.id == betId).findFirst().ifPresent(b -> {
      b.status = "cashed_out";
      b.cashoutMultiplier = mult;
      b.winAmount = win;
      save();
    });
  }

  public synchronized void markBet(long betId, String status) {
    data.bets.stream().filter(b -> b.id == betId).findFirst().ifPresent(b -> {
      b.status = status;
      save();
    });
  }

  public synchronized double sumVolumeReal() {
    return round2(data.bets.stream()
        .filter(b -> b.userId > 0 && !"cancelled".equals(b.status))
        .mapToDouble(b -> b.betAmount).sum());
  }

  public synchronized double sumPayoutsReal() {
    return round2(data.bets.stream()
        .filter(b -> b.userId > 0 && "cashed_out".equals(b.status))
        .mapToDouble(b -> b.winAmount).sum());
  }

  public synchronized long countCompletedRounds() {
    return data.gameRounds.stream().filter(r -> "completed".equals(r.status)).count();
  }

  public synchronized Tx insertTx(long userId, String type, double amount, double balanceAfter, String description) {
    Tx t = new Tx();
    t.id = next("transactions");
    t.userId = userId;
    t.type = type;
    t.amount = amount;
    t.balanceAfter = balanceAfter;
    t.description = description;
    t.createdAt = Instant.now().toString();
    data.transactions.add(t);
    save();
    return t;
  }

  public synchronized List<Map<String, Object>> listTransactions(int limit) {
    List<Tx> txs = new ArrayList<>(data.transactions);
    Collections.reverse(txs);
    return txs.stream().limit(limit).map(t -> {
      User u = findById(t.userId);
      Map<String, Object> m = new LinkedHashMap<>();
      m.put("id", t.id);
      m.put("user_id", t.userId);
      m.put("username", u != null ? u.username : "Unknown");
      m.put("type", t.type);
      m.put("amount", t.amount);
      m.put("balance_after", t.balanceAfter);
      m.put("description", t.description);
      m.put("created_at", t.createdAt);
      return m;
    }).collect(Collectors.toList());
  }

  public synchronized List<Tx> userTransactions(long userId) {
    List<Tx> list = data.transactions.stream().filter(t -> t.userId == userId).collect(Collectors.toCollection(ArrayList::new));
    Collections.reverse(list);
    return list.stream().limit(50).collect(Collectors.toList());
  }

  public synchronized List<Map<String, Object>> topWins() {
    return data.bets.stream()
        .filter(b -> "cashed_out".equals(b.status))
        .sorted(Comparator.comparingDouble((Bet b) -> b.winAmount).reversed())
        .limit(15)
        .map(b -> {
          User u = findById(b.userId);
          Map<String, Object> m = new LinkedHashMap<>();
          m.put("id", b.id);
          m.put("bet_amount", b.betAmount);
          m.put("cashout_multiplier", b.cashoutMultiplier);
          m.put("win_amount", b.winAmount);
          m.put("created_at", b.createdAt);
          m.put("username", u != null ? u.username : "Unknown");
          return m;
        }).collect(Collectors.toList());
  }

  public synchronized List<Map<String, Object>> userBets(long userId) {
    List<Bet> list = data.bets.stream().filter(b -> b.userId == userId).collect(Collectors.toCollection(ArrayList::new));
    Collections.reverse(list);
    return list.stream().limit(40).map(b -> {
      GameRound r = data.gameRounds.stream().filter(g -> g.id == b.roundId).findFirst().orElse(null);
      Map<String, Object> m = new LinkedHashMap<>();
      m.put("id", b.id);
      m.put("round_id", b.roundId);
      m.put("bet_amount", b.betAmount);
      m.put("cashout_multiplier", b.cashoutMultiplier);
      m.put("win_amount", b.winAmount);
      m.put("status", b.status);
      m.put("created_at", b.createdAt);
      m.put("round_crash_multiplier", r != null ? r.crashMultiplier : 1.0);
      m.put("round_number", r != null ? r.roundNumber : 0);
      return m;
    }).collect(Collectors.toList());
  }

  private long next(String key) {
    long v = data.nextId.getOrDefault(key, 1L);
    data.nextId.put(key, v + 1);
    return v;
  }

  public static double round2(double v) {
    return Math.round(v * 100.0) / 100.0;
  }
}
