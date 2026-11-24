package com.rikshawx.store;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class Models {
  private Models() {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class User {
    public long id;
    public String username;
    public String email;
    @JsonProperty("password_hash") public String passwordHash;
    public double balance;
    public String role;
    @JsonProperty("is_banned") public int isBanned;
    @JsonProperty("created_at") public String createdAt;
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class GameRound {
    public long id;
    @JsonProperty("round_number") public long roundNumber;
    @JsonProperty("server_seed") public String serverSeed;
    @JsonProperty("client_seed") public String clientSeed;
    public String hash;
    @JsonProperty("seed_hash") public String seedHash;
    public Long nonce;
    @JsonProperty("chain_hash") public String chainHash;
    @JsonProperty("crash_multiplier") public double crashMultiplier;
    public String status;
    @JsonProperty("started_at") public String startedAt;
    @JsonProperty("crashed_at") public String crashedAt;
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class Bet {
    public long id;
    @JsonProperty("round_id") public long roundId;
    @JsonProperty("user_id") public long userId;
    @JsonProperty("panel_id") public int panelId;
    @JsonProperty("bet_amount") public double betAmount;
    @JsonProperty("auto_cashout") public Double autoCashout;
    @JsonProperty("cashout_multiplier") public Double cashoutMultiplier;
    @JsonProperty("win_amount") public double winAmount;
    public String status;
    @JsonProperty("created_at") public String createdAt;
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class Tx {
    public long id;
    @JsonProperty("user_id") public long userId;
    public String type;
    public double amount;
    @JsonProperty("balance_after") public double balanceAfter;
    public String description;
    @JsonProperty("created_at") public String createdAt;
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class StoreData {
    public List<User> users = new ArrayList<>();
    @JsonProperty("game_rounds") public List<GameRound> gameRounds = new ArrayList<>();
    public List<Bet> bets = new ArrayList<>();
    public List<Tx> transactions = new ArrayList<>();
    @JsonProperty("system_settings") public Map<String, String> systemSettings = new LinkedHashMap<>();
    @JsonProperty("nextId") public Map<String, Long> nextId = new LinkedHashMap<>();
  }
}
