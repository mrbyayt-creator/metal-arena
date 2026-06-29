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


## V4 polish update

- Random safe spawn in campaign and survival.
- Denser arena cover and refined obstacle/projectile collision checks.
- Campaign difficulty scaled down: level 30 is close to previous level 15.
- Background music is loaded from `assets/audio/background_music.mp3`.
