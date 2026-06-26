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

This build fixes Quick Play PvP joining, English UI leftovers, default Player#### names, and faster visual hit feedback.


## Latest patch

Chat moderation now masks all blocked/contact messages with stars, bullets ride over terrain, collisions have speed-based self damage/effects, container collision/grounding was adjusted, exhaust smoke was added, and reverse switching was made faster.
