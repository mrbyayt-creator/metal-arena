# METAL ARENA — AFK fix

Changes limited to AFK behavior:

- AFK timeout reduced to 1 minute.
- AFK activity is reset only by the player's own driving input sent in state packets.
- Shooting, taking damage, chat, lobby actions, and being pushed no longer reset AFK.
- AFK kicks are announced in chat via a localizable client message.
