# MOVE-003 – Move plan, conflicts, report and undo

- Status: implemented
- Area: move
- Origin: `docs/plan.md` Moving pictures, `docs/05-name-templates.md` Collisions, M7.2, ADR 0018
- Depends on: MOVE-001, MOVE-002

## Purpose

Turns rendered pictures and the target folders' existing names into the move request, with each
conflict resolved by the user's choice; words nothing itself, so the move summary (M7.3) can show
the plan and the report. The modules are pure.

## Behaviour

**Folders to probe** are the distinct folders of every rendered file below the target folder, in
order, from the user's files with a leading `/`.

**Plan.** Every file's path is the target folder joined with its rendered path. Pictures first get
their suffix within the move (MOVE-001 Collisions). A picture is *in conflict* when one of its paths
is taken, case-insensitively, by an existing file that is not the file itself. Its choice decides:

| Choice | Paths | Sent |
|---|---|---|
| *Add suffix* (the default) | The lowest suffix (none, `-2`, `-3`, …) at which no path is taken by an existing file or by another picture of the move | yes |
| *Skip* | Unchanged, shown only | no |
| *Replace* | Unchanged; each taken path names its existing file to replace | yes |

A picture not in conflict ignores its choice. A conflict whose existing file is itself moved by the
same request cannot be replaced, since the server refuses that (MOVE-002.8); the picture takes
*Add suffix* instead.

**Request.** The sent pictures in order, each file with its file id, its listing ETag, its path and,
for a replace, the existing file's id and ETag.

**Report.** From the response: the moved files with their old path, new path, new file id and
ETag; the failed files with their result; the pictures all of whose sent files moved; and how many
files went to the trash bin as replaced. A file the response leaves out, answers with an unknown
result, or answers `moved` without its new path, file id or ETag counts as `failed`.

**Undo** is a move request that sends every moved file, by its new file id and ETag, back to its
old path, grouped by picture; a file that stayed at its path is left out. Replaced files are not
part of it: they stay in the trash bin.

## Acceptance criteria

### MOVE-003.1 – The folders to probe

- **Given** a target folder (also the root `/`) and rendered pictures with files in several
  subfolders
- **When** the folders to probe are asked for
- **Then** each distinct folder appears once, in order of first use, with a leading `/`

### MOVE-003.2 – Paths join the target folder and keep the in-move suffix

- **Given** pictures that render the same path, and no existing files
- **When** the move is planned
- **Then** each file's path is below the target folder, the later picture has `-2`, and no picture
  is in conflict

### MOVE-003.3 – A taken path is a conflict, the file itself is not

- **Given** existing files at a picture's path in another letter case, and a file already at its own
  path
- **When** the move is planned
- **Then** the first picture is in conflict with its file naming the existing file, the second is not

### MOVE-003.4 – Add suffix takes the next free number

- **Given** a picture in conflict with *Add suffix*, existing files at `-2`, and a later picture of
  the move whose path is free
- **When** the move is planned
- **Then** the picture takes `-3` for all its files, and no path of the plan is taken twice

### MOVE-003.5 – Skip and Replace

- **Given** one picture in conflict with *Skip*, one with *Replace*, and one whose conflict is with
  a file the request moves too, with *Replace*
- **When** the move is planned and its request built
- **Then** the skipped picture keeps its paths and is not sent, the replaced picture is sent with
  `replace` naming each existing file with its ETag, and the third takes *Add suffix*

### MOVE-003.6 – The report counts moved, failed and replaced files

- **Given** a request and a response with `moved`, `replaced`, failed and `movedBack` files, an
  unknown result, a `moved` without its new file id and a file left out
- **When** the report is made
- **Then** moved files carry old and new path, new file id and ETag; the others are failed with
  their result, unknown ones as `failed`; only pictures whose sent files all moved count, and the
  replaced files are counted

### MOVE-003.7 – Undo moves the files back

- **Given** a report with moved files of two pictures and one file that stayed at its path
- **When** the undo request is built
- **Then** it sends each moved file by its new file id and ETag to its old path, one list per
  picture, without the file that stayed

## Out of scope

The dialog, the move summary's text, the undo toast and the key `M` are M7.3. The endpoints are
MOVE-002.

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written and implemented with M7.2 (ADR 0018). |
