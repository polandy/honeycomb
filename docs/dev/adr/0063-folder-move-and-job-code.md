# 0063 – Folder move and the job code token

- Status: accepted
- Date: 2026-11-28
- Extends: [0018](0018-move-endpoint-and-pair-atomicity.md), [0029](0029-move-and-trash-requests-in-chunks.md)

## Context

The owner wants to move every picture of a folder at once, renamed by the name template, and to
name the shoot in the template with a short text typed when the move starts, as Rapid Photo
Downloader's *Job Code* does. A move today starts from the selection, the loupe, the picks or the
filter (MOVE-004). Moving many pictures also moves many sidecars, which digiKam and darktable must
still find afterwards: a darktable duplicate's `IMG_0001_01.NEF.xmp` was renamed to
`<new name>.01.NEF.xmp`, which darktable no longer reads as the duplicate of `<new name>.NEF`.

The options for the trigger:

- **A new server job that moves a folder:** survives the browser, but needs a queue, a table and
  a second rename implementation in PHP, against ADR 0006.
- ***Move all* in the cull's More menu:** the folder set's listing is already in the browser, the
  move dialog, its summary, conflicts, chunks (ADR 0029) and undo stay as they are.

The options for the job code:

- **A setting:** one value until changed; a forgotten change misnames the next shoot.
- **A field in the move dialog, prefilled with the last one:** asked at each move, as Rapid Photo
  Downloader asks when a job starts.

## Decision

- **Trigger:** *Move all* in the More menu of the cull moves every picture of the open folder set
  through the existing move dialog and endpoints (MOVE-005). A *Move folder…* on the *Folders*
  screen comes later and opens the same flow.
- **Job code:** a template token `{job}` with `:lower` and `:upper`, sanitised like every value.
  The move dialog asks for it when the template uses it, prefilled with the last one; empty after
  sanitising blocks the move; at most 40 characters. The recent job codes (5) are a settings list
  (ADR 0051), not a new table.
- **Sidecars:** each sidecar keeps its form on a rename: `<member>.xmp`, the shared `<base>.xmp`
  and a darktable duplicate's `<base>_NN.<ext>.xmp`, whose `_NN` follows the new name and the
  collision suffix (MOVE-001.16).
- **Big folders:** the requests stay those of ADR 0029; the move summary shows pages of 200
  pictures so a folder of thousands does not render every file row at once.

## Consequences

- No new endpoint, table or migration; the move keeps its atomicity per picture and its undo.
- A folder move lives as long as the browser tab; a closed tab stops it between requests, and the
  report and *Undo* of what was sent are lost with the tab, as for any large move today.
- The name template module gains one token and one input value, the job code, which every caller
  passes.
