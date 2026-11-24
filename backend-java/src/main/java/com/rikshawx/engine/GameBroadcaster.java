package com.rikshawx.engine;

public interface GameBroadcaster {
  void emit(String event, Object data);
  void emitToUser(long userId, String event, Object data);
}
