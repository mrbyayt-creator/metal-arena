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

This build adds 2-minute AFK kicks in every lobby, improves engine/collision audio, restores larger but grounded suspension hops, tightens vehicle-vs-container collision, and makes non-mortar projectile hits require touching the vehicle body.
