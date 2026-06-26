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

This build keeps the last chat/collision fixes and only adjusts the requested tuning:
- larger mortar explosion radius, same mortar homing radius;
- rockets stop trying to home to their owner when no target is available;
- wall self-damage reduced and made non-lethal below 5 HP;
- smoother hill bump suspension instead of flying;
- closer container collision and deeper placement;
- softer crash sound;
- server-side authoritative PvP damage HP replication with local visual prediction preserved.
