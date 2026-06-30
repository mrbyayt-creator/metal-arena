# METAL ARENA — body collision fix

Only projectile hit detection for vehicle bodies was adjusted.

Changes:
- Removed the broken detailed-part hitboxes from the previous test build.
- Direct projectile damage now uses one clean oriented body box per vehicle type.
- The body box covers the actual car body/vehicle footprint instead of a tiny roof/cabin zone.
- The previous fix that removed the accidental default radius around normal bullets is preserved.

No other gameplay systems were intentionally changed.


Additional change in this package:
- Vehicle-to-vehicle collision now uses the same per-vehicle body OBB hitboxes as direct projectile hits.
- Removed the old circular car push/ram check for car-to-car collisions; no other gameplay systems were intentionally changed.
