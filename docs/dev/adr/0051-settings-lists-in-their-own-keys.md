# 0051 – Settings: the lists in their own keys, the object versioned

- Status: accepted
- Date: 2026-11-22
- Amends: [0014](0014-settings-endpoint.md)

## Context

ADR 0014 stores the settings as one JSON object that the client writes whole. Two tabs or devices
each hold a copy, so a save from one overwrites every field the other changed since it read. The
lists suffer most: every move puts its target at the front of the recent move targets, the move
dialog stars favourites, and *Folders* edits the library roots, each while another tab may save a
switch from an old copy. A lost recent target or library root goes unnoticed. The object also had
no version, so a later change of a field's meaning could not tell old objects from new ones.

## Decision

- **Own keys.** The lists `moveRecent`, `moveFavourites` and `libraryRoots` are stored each in its
  own `IUserConfig` key of app `honeycomb`: `move_recent`, `move_favourites` and `library_roots`,
  a JSON list each. Every other setting stays in the object under `settings`.
- **Write a list:** `PUT /apps/honeycomb/api/v1/settings/lists/{name}`, `name` one of the three
  field names, body `{"items": [...]}`, stores the whole list and answers `{"items": [...]}`. The
  server checks only that `items` is a JSON list of strings of at most 8 KB encoded; `400` for an
  unknown name or any other body. Same rate limit as the object.
- **Write the object:** `PUT /api/v1/settings` as before; the server drops the three list fields
  from it, so a client cannot overwrite a list through the object.
- **Read:** `GET /api/v1/settings` answers one object as before: the stored object with each list
  from its own key. The client keeps a single read and a single parser.
- **Carried over.** Objects stored before this ADR hold the lists. While a list's own key is
  unset, the read takes the list from the object, and the next save of the object first writes
  that list into its key. No repair step: the object is read and written on every visit.
- **Versioned.** The client writes `version: 1` into the object (`SETTINGS_VERSION` in
  `src/logic/settings.ts`); the parser reads an object without `version` as version 1, the only
  format so far. A later format change raises the version and migrates in the parser.
- **The client splits each change:** a change of a list saves only that list, a change of any
  other setting saves only the object. Both keep the rules of ADR 0014 for failures and for a
  change made before the settings were read.

## Consequences

- Two tabs no longer lose each other's list changes when one changes a switch. Within one list,
  and within the object, the last write still wins; the lists change often enough to need their
  own key, the switches do not.
- A client from before this ADR, still open during an update, has its list changes in the object
  dropped until it reloads.
- Each list has its own 8 KB, so the recent targets no longer eat into the object's budget.

## Considered

- **A merging `PATCH` of changed fields** would also cover the switches, but keeps all lists in
  the one 8 KB object and changes the write semantics of every setting at once.
- **A server-side "add recent target"** would merge concurrent moves into one list, but puts list
  logic into PHP against ADR 0006.
