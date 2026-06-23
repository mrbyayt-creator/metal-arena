# METAL ARENA — Railway build

This package is prepared for GitHub → Railway deployment.

## Files

- `index.html` — game client
- `server.js` — HTTP + WebSocket multiplayer server
- `package.json` — Node.js start command
- `railway.json` — Railway deploy config
- `.gitignore` — ignores local junk / node_modules

## Local test

```bash
node server.js
```

Open:

```text
http://localhost:8080
```

## Railway settings

Railway should auto-detect Node.js from `package.json`.

Start command:

```bash
npm start
```

The server uses Railway's `PORT` environment variable automatically.

## CrazyGames later

After Railway gives a public domain, the WebSocket URL will look like:

```text
wss://YOUR-PROJECT.up.railway.app
```

For a CrazyGames client build, set `PUBLIC_WS_URL` in `index.html` to that Railway `wss://` address.
