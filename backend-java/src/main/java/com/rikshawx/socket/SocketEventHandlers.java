package com.rikshawx.socket;

import com.corundumstudio.socketio.SocketIOServer;
import com.rikshawx.engine.CrashEngine;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class SocketEventHandlers {
  private final SocketIOServer server;
  private final SocketIOConfig socketIOConfig;
  private final CrashEngine engine;

  public SocketEventHandlers(SocketIOServer server, SocketIOConfig socketIOConfig, CrashEngine engine) {
    this.server = server;
    this.socketIOConfig = socketIOConfig;
    this.engine = engine;
  }

  @PostConstruct
  public void register() {
    server.addEventListener("game:init", Map.class, (client, data, ack) -> {
      Long userId = null;
      if (data != null && data.get("userId") != null) {
        userId = Long.parseLong(String.valueOf(data.get("userId")));
        client.joinRoom("user_" + userId);
      }
      client.sendEvent("game:snapshot", engine.getSnapshot(userId));
    });

    server.addEventListener("bet:place", Map.class, (client, data, ack) -> {
      long userId = Long.parseLong(String.valueOf(data.get("userId")));
      int panelId = Integer.parseInt(String.valueOf(data.get("panelId")));
      double amount = Double.parseDouble(String.valueOf(data.get("amount")));
      Double auto = data.get("autoCashout") == null || String.valueOf(data.get("autoCashout")).equals("null")
          ? null : Double.parseDouble(String.valueOf(data.get("autoCashout")));
      String sessionToken = readSessionToken(data);
      Map<String, Object> result = engine.placeBet(userId, panelId, amount, auto, sessionToken);
      if (ack.isAckRequested()) ack.sendAckData(result);
    });

    server.addEventListener("bet:cancel", Map.class, (client, data, ack) -> {
      long userId = Long.parseLong(String.valueOf(data.get("userId")));
      int panelId = Integer.parseInt(String.valueOf(data.get("panelId")));
      String sessionToken = readSessionToken(data);
      Map<String, Object> result = engine.cancelBet(userId, panelId, sessionToken);
      if (ack.isAckRequested()) ack.sendAckData(result);
    });

    server.addEventListener("bet:cashout", Map.class, (client, data, ack) -> {
      long userId = Long.parseLong(String.valueOf(data.get("userId")));
      int panelId = Integer.parseInt(String.valueOf(data.get("panelId")));
      Map<String, Object> result = engine.cashoutBet(userId + "_" + panelId);
      if (ack.isAckRequested()) ack.sendAckData(result);
    });

    server.addEventListener("chat:message", Map.class, (client, data, ack) -> {
      if (data.get("username") == null || data.get("message") == null) return;
      String msg = String.valueOf(data.get("message")).trim();
      if (msg.isEmpty()) return;
      if (msg.length() > 120) msg = msg.substring(0, 120);
      Map<String, Object> out = new LinkedHashMap<>();
      out.put("id", System.currentTimeMillis() + Math.random());
      out.put("username", data.get("username"));
      out.put("avatar", data.getOrDefault("avatar", "🧑‍✈️"));
      out.put("message", msg);
      out.put("timestamp", LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm")));
      server.getBroadcastOperations().sendEvent("chat:broadcast", out);
    });

    socketIOConfig.startServer();
  }

  private static String readSessionToken(Map data) {
    if (data == null || data.get("sessionToken") == null) return null;
    String t = String.valueOf(data.get("sessionToken"));
    if (t.isBlank() || "null".equalsIgnoreCase(t)) return null;
    return t;
  }
}
