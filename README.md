# METAL ARENA — CrazyGames-ready build

This build keeps the latest gameplay and adds/cleans the CrazyGames integration layer.

Changed in this package only:
- CrazyGames SDK v3 safe initialization.
- `loadingStop`, `gameplayStart`, `gameplayStop`, and game context calls.
- Multiplayer `updateRoom`, `leftRoom`, `showInviteButton`, invite params, and join-room listener.
- Invite URL fallback for local testing: `?roomId=...&mode=tdm&ws=wss://...`.
- Robust WebSocket URL selection for CrazyGames builds: URL param, `window.METAL_ARENA_WS_URL`, localStorage, `PUBLIC_WS_URL`, then same-origin fallback.
- `/ping` and `/health` HTTP endpoints on the game server.
- Online menu labels changed to Online PVP lobby / Online survival lobby.

For GitHub/Railway deployment, upload the whole package.
For a CrazyGames-hosted HTML build, set `PUBLIC_WS_URL` in `index.html` to your Railway `wss://...` server URL.

No gameplay balance/mechanics were intentionally changed.
