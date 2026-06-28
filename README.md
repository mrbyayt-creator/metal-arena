# METAL ARENA — Railway build

Node.js WebSocket server + browser client.

## Local run

```bash
npm start
```

Open:

```text
http://localhost:8080
```

## Railway

Deploy from GitHub. Railway uses `package.json` and `railway.json`.

Start command:

```bash
npm start
```

Required files in repository:

- `index.html`
- `server.js`
- `package.json`
- `railway.json`
- `.gitignore`

## Update notes

This build adds a closable AFK kick notice and retunes the bump hop physics so cars do not launch from small slopes but still bounce on real bumps.


## Junkyard ground fix

Junkyard now uses the supplied top-down texture as the visible playable surface. The imported OBJ is lifted back above the ground instead of being buried below it. Old generated Junkyard terrain remains disabled.
