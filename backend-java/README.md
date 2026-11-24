# RikshawX Spring Boot Backend

Java/Spring Boot port of the Node crash-game engine.

## Ports
- **REST API:** `http://localhost:5000`
- **Socket.IO:** `http://localhost:5001`

Frontends keep API calls on `:5000` and connect sockets to `:5001`.

## Run
Stop the Node backend first (it also uses port 5000), then:

```bat
mvnw.cmd spring-boot:run
```

Or from repo root:

```bat
npm run start:backend-java
```

## Provider Game SDK (`in.oreng:game-sdk`)
Wallet debit/credit goes through Provider when enabled:

```bat
set PROVIDER_ENABLED=true
set PROVIDER_API_URL=https://api.dpbossking.com/api/v1
set GAME_SERVER_API_KEY=your-secret
mvnw.cmd spring-boot:run
```

- Bet place → `debit`
- Cashout / cancel refund → `credit`
- Without `sessionToken` (or provider disabled) → local JSON wallet

Client launches with `?sessionToken=...` and uses `@gamotech/game-sdk-client` for session + round events.

## Data
Persists to **MongoDB** (`MONGODB_URI` + `MONGODB_DATABASE` in `.env`).
The legacy `backend/data/store.json` file is no longer written.

Default admin: `admin` / `123456`

## Stack
- Spring Boot 4 (Web MVC)
- netty-socketio
- `in.oreng:game-sdk` (Provider wallet)
- JJWT
- BCrypt (spring-security-crypto)
