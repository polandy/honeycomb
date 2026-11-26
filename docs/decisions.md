# Decisions

Decisions the agents made in the owner's place, one dated line each, newest last.

- 2026-11-26: *Resume* on an Immich connection opens under the open filters unless they leave the
  stored asset's capture time out or admit no undecided picture; then every filter goes back to its
  default over the whole time (IMMICH-003.14).
- 2026-11-26: A resume whose asset Immich no longer lists opens at the next older upload, with the
  loupe on the first entry (IMMICH-002.34).
- 2026-11-26: The newer Immich pages load as the loupe comes within twelve entries of the first
  loaded one, and in the grid on *Show newer photos* above it, not by scrolling up (IMMICH-002.34).
- 2026-11-26: *Recent* lists the Immich connections before the folder sets, by label with *Immich ·
  x / y decided*; a connection's position does not count against the folder sets' limit and adds no
  active time (IMMICH-003.15, IMMICH-003.23).
- 2026-11-26: The connection's position is a row of `honeycomb_positions` keyed
  `immich:<connectionId>` with its `asset_id` and `taken_at`, not a new table (IMMICH-003.14).
