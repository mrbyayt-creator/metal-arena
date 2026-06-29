# METAL ARENA — V4 polish update

This build keeps the previous gameplay version and only retunes the requested visual/collision polish:

- bot/remote rockets now explode visually when they touch the player's car body instead of sitting inside it;
- offline bot projectile damage is handled by projectile contact, not by a delayed fake hit;
- container/box visuals got procedural low-poly texture details and simple decorative geometry;
- existing gameplay, modes, SDK, chat and AFK logic are otherwise preserved.

Run locally:

```bash
npm start
```

Open:

```text
http://localhost:8080
```
