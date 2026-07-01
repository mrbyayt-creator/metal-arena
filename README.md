# METAL ARENA — GitHub/Railway + CrazyGames SDK build

This is the full GitHub/Railway build.

Included:
- `index.html` — game client with CrazyGames SDK v3 integration
- `server.js` — WebSocket/HTTP server
- `package.json` — npm start script
- `railway.json` — Railway deploy config
- `assets/audio/background_music.mp3`

CrazyGames SDK integration added/checked:
- SDK v3 script + safe initialization
- gameplayStart / gameplayStop
- loadingStart / loadingStop
- muteAudio platform setting
- disableChat platform setting
- CrazyGames username autofill when available
- updateRoom / leftRoom for multiplayer rooms
- addJoinRoomListener + inviteParams join handling
- invite link copy button in lobby
- instant multiplayer quick PvP flow
- game context for match feedback/debug context

For the GitHub/Railway version, the client connects to the same origin WebSocket server automatically.
For the CrazyGames upload version, use the separate CrazyGames index build where the WebSocket server is fixed to:
`wss://metal-arena-production.up.railway.app`
