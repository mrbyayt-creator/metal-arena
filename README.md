# METAL ARENA — network hit prediction fix

Changes in this package are limited to network hit/death feedback:

- Shooter client now shows immediate predicted remote death/explosion when local predicted damage reaches zero HP.
- Server now broadcasts PvP/round death immediately when authoritative HP reaches zero instead of waiting for the killed client to report death.
- Duplicate death explosions are suppressed when prediction is later confirmed by the server.
- If the server confirms the target is still alive, predicted death visuals are cleared on the next HP/state update.

Other gameplay systems were not intentionally changed.
