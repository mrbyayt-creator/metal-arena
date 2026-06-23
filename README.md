# METAL ARENA

## Local test

```bash
npm install
npm start
```

Open:

```text
http://localhost:8080
```

For local testing the game connects to the same server automatically:

```text
ws://localhost:8080
```

## Fly.io / public server

The client uses the same origin by default:

```text
https://your-app.fly.dev -> wss://your-app.fly.dev
```

For a separate CrazyGames client build, set `PUBLIC_WS_URL` in `index.html` to your public WebSocket server, for example:

```js
const PUBLIC_WS_URL = 'wss://your-app.fly.dev';
```

## CrazyGames prep included

This build includes a safe CrazyGames SDK wrapper:

- gameplayStart / gameplayStop
- updateRoom / leftRoom
- addJoinRoomListener / invite params foundation
- Instant Multiplayer foundation
- disableChat support
- client + server chat moderation filter
- Quick Play button

Game mechanics are not changed.
