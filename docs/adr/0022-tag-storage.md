# 0022 – Tag storage: a row of tags per file id and user, and a tag list per user

- Status: accepted
- Date: 2026-11-13

## Context

Tags are kept like the other decisions: the database is the working state, read from the sidecars
when a picture is first listed and written through to them ([`07-tags.md`](../07-tags.md) Model,
ADR 0005). The client merges the members of a picture, filters and autocompletes (ADR 0006). The
tag list keeps every tag the user ever had, also when no picture has it any more (D6). A bulk
action can tag 2,000 pictures of two or three files each at once. A tag is a path of up to 255
characters; MySQL compares strings without regard to case and accents by default, so `Anna` and
`anna` collide under a unique index on the text.

The options:

- **A `tags` column in `honeycomb_decisions`:** one row and one request per picture, but every
  decision save would have to carry the tags, and a client that sends none would erase them.
- **One row per file and tag:** queryable on the server, but nothing filters there, and a unique
  index on the text breaks on MySQL's collation.
- **One row per file with its tags as JSON, beside the decisions:** saved and read like the
  decisions, independent of them.

## Decision

- **Tables.** `honeycomb_file_tags`: `user_id`, `file_id` (unique together), `tags` (JSON list of
  the file's tags, sorted, each once). A file without tags has no row. `honeycomb_tag_list`:
  `user_id`, `tag`, indexed by user; compared in PHP, not by the database, so case and accents
  count.
- **A tag** is a string of at most 255 characters whose names, split at `/`, are not empty, have
  no space at either end and contain no `|` (the form `tagOf()` in `src/logic/tag.ts` writes). A
  file has at most 100 tags.
- **Read tags:** `POST /apps/honeycomb/api/v1/tags/lookup` with `{"fileIds": [...]}`, at most
  60,000, answers `{"tags": [{"fileId": 9, "tags": ["Places/Italy"]}, ...]}` with the stored rows
  only, in file id order.
- **Write tags:** `PUT /apps/honeycomb/api/v1/tags` with `{"tags": [{"fileId": 9, "tags":
  [...]}, ...]}`, at most 60,000, whole states in one transaction, like decisions (ADR 0012): undo
  sends the earlier state back. An empty list removes the row. Every tag saved joins the tag list.
  A malformed item, a file id twice or a tag twice in one item rejects the whole request with
  `400`; nothing is written. A save that loses a race on the unique key is repeated, as decisions
  are.
- **Tag list:** `GET /apps/honeycomb/api/v1/tags/list` answers `{"tagList": [...]}`, sorted, each
  once.
- **Lifecycle** as decisions: a move that gives a file a new id carries its tags over; the daily
  job removes the rows of files deleted for good; deleting a user removes their rows and tag
  list. The tag list keeps the tags of removed rows (D6).
- **Errors:** `400` for a malformed body or more than the limit; `401` without a user. The body is
  empty. File ids are not looked up, as for decisions (ADR 0012).

## Consequences

- A tag change is one request beside the decision save; the client sends both when one action
  changes both.
- Two saves at once can add the same new tag to the tag list twice; reading it removes the
  duplicate.
- A sidecar tag over 255 characters cannot be stored; the client leaves it out.
- Renaming or deleting tags across pictures (D7) needs a new endpoint later.
- A new field is added, never renamed or removed, without a new version in the path.
