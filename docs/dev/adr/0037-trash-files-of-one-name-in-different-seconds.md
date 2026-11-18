# 0037 – Trash files of one name in different seconds

- Status: accepted
- Date: 2026-11-18

## Context

Nextcloud's `Trashbin::move2trash` (35.0.x, `apps/files_trashbin/lib/Trashbin.php`) names the
trash copy `<name>.d<seconds>`, the seconds from its `ITimeFactory`. If that name exists, it
unlinks the existing copy and adds a second `files_trash` row; its lock only nudges the second
for deletes that run in parallel. Team folders name their trash copies the same way. So two
files of one name trashed one after the other in the same second, e.g. `IMG_0001.jpg` from two
folders of a folder set in one bulk delete, lose the first file's trash copy, and restoring picks
the first row's location for the second file's bytes.

The options:

- **Wait for the next second before each file of a name already trashed in this second:** simple,
  but a folder set whose same-named pictures sit next to each other, e.g. two cameras sorted by
  capture time, waits about a second per picture and a request of 500 files runs into the proxy
  timeout ADR 0029 avoids.
- **The same, but trash the pictures that do not collide first:** a request then waits about one
  second per extra file of one name, at most as many seconds as a folder set has folders.
- **Look for `<name>.d<now>` in the owner's trash bin before each delete:** also catches a file
  trashed by an earlier request or in Files, but depends on the trash bin's layout per backend
  (user trash bin, Team folders) and on internal paths.
- **Fix it upstream:** right, but it does not protect the releases honeycomb supports.

## Decision

- `TrashNameSpacing` remembers per request the last second each name may have been trashed in:
  the clock read after the delete, since Nextcloud reads its own clock during it. A file is trashed
  only when the clock is past that second; else it pauses for the next second.
- `TrashService` defers a picture whose file to trash shares a name with one trashed in the
  current second and trashes the other pictures first; when every remaining picture is deferred,
  it pauses for the next second. The answer keeps the order sent.
- A file deleted for good (ADR 0036) makes no trash copy and does not wait.
- The clock (`ITimeFactory`) and the pause (`Pause`) are injected, so tests never sleep.

## Consequences

- A bulk delete keeps every file of one name in the trash bin, each restorable to its folder.
- A request with many files of one name takes up to a second longer per extra such file.
- Not covered: a file of the same name trashed in the same second by another request, in Files,
  or by the replace of a move (MOVE-002). This needs two requests within one second that each
  trash that name; looking into the trash bin can be added behind `TrashNameSpacing` later.
- An upstream fix (a free name instead of the unlink) would let `TrashNameSpacing` go.
