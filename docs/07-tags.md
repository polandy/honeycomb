# 7. Tags (concept)

**Status: in progress.** Step 2 of the [implementation outline](#implementation-outline), reading
and writing tags in sidecars, is built ([XMP-004](specs/xmp/XMP-004-tags-in-sidecars.md)); the
other steps are open in `TODO.md`. The owner asked for tags that work like digiKam's and are
read and written in digiKam's fields (2026-11-11), and answered the
[decisions](#decisions-2026-11-12) on 2026-11-12. The milestone is planned from the
[implementation outline](#implementation-outline). The approved mockup is
[`mockup/tag-entry.html`](mockup/tag-entry.html) (open it in a browser, no build).

## Sources

digiKam at `cfd1ed79` (2026-11-11), paths under `core/`. Anything not checked there is marked
**unverified**. The rating, flag and colour-label fields stay as in
[`06-xmp-interop.md`](06-xmp-interop.md).

| Claim | Where |
|---|---|
| Read order and separators of the tag fields | `libs/metadataengine/dmetadata/dmetadatasettingscontainer.cpp:308–385` |
| Reading stops at the first field with values (`readingAllTags` off by default) | `dmetadata_tags.cpp:33–193`, `dmetadatasettingscontainer.cpp:240` |
| Writing: every field from the same list, replaced whole | `dmetadata_tags.cpp:195–380`, `libs/metadataengine/engine/metaengine_xmp.cpp:783, 882` |
| Only the assigned tags are written, not their parents; internal tags never | `libs/fileactionmanager/metadatahub.cpp:144–156, 471–541`, `libs/database/tags/tagscache.cpp:1027–1043` |
| Reading `a/b/c` creates `a`, `a/b`, `a/b/c` and assigns only `a/b/c` | `libs/database/item/scanner/itemscanner_photo.cpp:425–455` |
| `/` is not allowed in a tag name; typing `a/b` creates a level | `libs/album/manager/albummanager_talbum.cpp:352, 524`, `tagscache.cpp:668` |
| Writing modes and their default (*write to file only*) | `libs/metadataengine/engine/metaengine.h:59–68`, `metaenginesettingscontainer.cpp:44–52` |
| A sidecar, when read, replaces the file's embedded XMP | `metaengine_fileio.cpp:220–270`, `metaengine_p.cpp:1036–1045` |
| `T` is *Assign Tag* in the album view | `app/main/digikamapp_setup.cpp:320–325` |
| Tag entry completes by substring, ignoring case | `libs/tags/engine/tagscompleter.cpp:92–95` |
| Enter on a name: an existing tag of that name, else a new one | `libs/tags/engine/taggingactionfactory.cpp:410–465` |

## What digiKam does

**Fields.** digiKam reads these in order and **stops at the first that has a value**:

| # | Field | Holds | Separator | Array |
|---|---|---|---|---|
| 1 | `digiKam:TagsList` | full path | `/` | `rdf:Seq` |
| 2 | `MicrosoftPhoto:LastKeywordXMP` | full path | `/` | `rdf:Bag` |
| 3 | `lr:hierarchicalSubject` | full path | `\|` | `rdf:Bag` |
| 4 | `mediapro:CatalogSets` | full path | `\|` | `rdf:Bag` |
| 5 | `acdsee:categories` | full path | `/` | ACDSee XML |
| 6 | `dc:subject` | leaf name only | – | `rdf:Bag` |
| 7 | IPTC `Keywords` | leaf name only | – | – |

On writing it fills **every** field of this list from the item's tags, each replaced whole:
`dc:subject` and IPTC get the leaf names, the others the full path with their separator. A
keyword that is in `dc:subject` but not a tag is dropped. A tag path written is only the assigned
tag (`Places/Italy/Dolomites`), never its parents as separate entries.

**Where.** digiKam's *Metadata Writing Mode* is one of *write to file only* (the default),
*sidecar only*, *sidecar and file*, or *sidecar only for read-only files*. Sidecars are read only
with *Read from sidecar* on (off by default); then the sidecar's XMP replaces the file's
embedded XMP as a whole. RAW files are written only with *Write to RAW files* on (off by
default). So a default digiKam writes tags into the JPEG and keeps a RAW's tags in its
database; honeycomb's ratings and flags already need *Read from sidecar* on (Q2).

## Model

- A **tag** is a path of names, written `Places/Italy/Dolomites` as in `digiKam:TagsList`. A
  picture has a set of tags. Parents are not added: tagging `Places/Italy/Dolomites` does not
  tag `Places`, as in digiKam.
- A **name** is any text without `/` and `|`, trimmed, not empty; `|` is refused too because
  `lr:hierarchicalSubject` uses it. Two tags with the same leaf in different places
  (`People/Anna`, `Pets/Anna`) are different tags.
- Tags are stored like the other decisions (Q2 (c), ADR 0005): the database is the working
  state, read from the sidecars when a picture is first listed, and written through to its
  sidecars. A tag change is one undo step and one toast: "Tagged DSC_4103 Sunrise · Undo",
  "Tagged 7 photos Dolomites · Undo", "Removed Anna from 2 photos · Undo".
- The **tag list** offered by autocomplete and the filter is every tag read from the user's
  sidecars plus every tag the user created, kept per user. Tags no picture has any more stay
  in it, so a vocabulary built over years is not lost when a folder is culled empty (D6).

## Reading

From each sidecar honeycomb takes the tags of the **first** of these fields with a value, as a
default digiKam does: `digiKam:TagsList` (`/`), `lr:hierarchicalSubject` (`|`, a `/` inside a
name read as `\`, as digiKam does), `dc:subject` (each keyword a tag without parents). Fields 2,
4, 5 and IPTC are not read; digiKam, darktable and Lightroom always write one of the three.

**Several sources of one picture.** A pair has up to four: `IMG.NEF.xmp`, `IMG.JPG.xmp`,
the shared `IMG.xmp` and the JPEG's embedded XMP (read only, D1). Ratings and flags take the most
recently modified sidecar as a whole (`06-xmp-interop.md`). For tags they are the
**union** of all sources (D2): tags are added in many places over the years, and dropping
the older sidecar's tags would lose work no other program shows the user. Writing then brings
every source to the same set, so a disagreement does not last.

## Writing

honeycomb writes the three fields it reads and leaves the others alone:

| Property | Value |
|---|---|
| `digiKam:TagsList` | `rdf:Seq` of the full paths, sorted, `/` |
| `lr:hierarchicalSubject` | `rdf:Bag` of the full paths, `\|` |
| `dc:subject` | `rdf:Bag`: the leaf names of the tags, plus every keyword already there that is not the leaf of a removed tag (D9) |

- **Change, not snapshot.** A write applies honeycomb's change (added and removed tags) to the
  tags the sidecar holds at that moment, so a tag digiKam added since the listing survives. The
  saving rules of `06-xmp-interop.md` (`.part`, ETag check, rename) are unchanged.
- **Empty.** With no tags left, `TagsList` and `hierarchicalSubject` are removed and
  `dc:subject` keeps only the foreign keywords.
- **Fields 2, 4, 5** (Microsoft, MediaPro, ACDSee) are left as they are. Because digiKam reads
  `TagsList` first and honeycomb always writes it, a stale field 2 or 4 is never read by digiKam.
- **Where:** every sidecar of the picture, by the sidecar rules of `06-xmp-interop.md`;
  the embedded XMP is never written (D1).
- A darktable sidecar is written the same way: darktable reads `lr:hierarchicalSubject` and
  keeps foreign properties (`06-xmp-interop.md`).

## Interaction

Approved mockup: [`mockup/tag-entry.html`](mockup/tag-entry.html).

### Selecting

A visible **Select** button in the grid enters selection mode (**Done** leaves it); a tap toggles
a tile. A long-press on touch is a shortcut (D8). Ctrl/Shift-click, arrows, Shift+arrows and
Ctrl+A work too. Outside selection mode a tap opens the loupe.

### Tag entry (`T`)

`T` opens the **tag entry** for the current picture in the loupe and the series viewer; in the
grid, for the selection. `T` is free in the key map (`plan.md` Keyboard shortcuts) and is
digiKam's *Assign Tag*. On touch, an icon button *Tags* opens it, placed in the `ActionBar` slot
(D8), and the loupe's info panel lists the tags.

- The tags of the targets as chips, × removes one from every target. A tag only some targets
  have is a **partial chip** (dashed). Tags that every target already has are not offered again.
- A text field with focus that filters by **substring, ignoring case**, as digiKam.
- `Tab` / `Shift+Tab` (or `↓` `↑`) cycle the matches into the field, `Enter` assigns exactly the
  field, creating the tag when it is new, `Backspace` in an empty field removes the last chip,
  `Esc` closes the entry, then the loupe.
- A `/` starts a level: `Places/Italy/Bolzano` creates the missing levels in the tag list and tags
  only the leaf.
- The entry stays open after assigning. Each change is one undo step for all targets and one
  toast: "Tagged 7 photos Dolomites · Undo", "Removed Anna from 2 photos · Undo". On a narrow
  screen it is a bottom sheet; the keyboard pushes it up.

### Tag filter

`F` opens the same entry to pick tags; the grid shows only the pictures that have **all** the
chosen tags (D4), chips with × remove one. A chip of a parent matches its descendants (D5). The
filter's count badge counts the tag chips. An *Untagged* chip and per-folder counts are not in
the mockup and are left to the milestone.

### Tiles and info panel

A tile shows a small tag icon and the count when the picture has tags (D3). The info panel lists
the tags and the sidecars they were written to.

## Decisions 2026-11-12

The owner approved the mockup and said to build it; each decision is the option marked.

- **D1 – Embedded XMP.** (a) Sidecars only; a JPEG's embedded XMP is read as one more source,
  never written. Nothing rewrites the user's photos.
- **D2 – Several sources.** (a) Union of all, then every source written to the same set.
- **D3 – Tile.** (a) A tag icon and the count, shown only when tagged.
- **D4 – Several tag chips in the filter.** (b) AND: the approved mockup shows only pictures that
  have all the chosen tags. This deviates from the earlier recommendation (OR, like the other
  groups): within the tag filter the chips narrow, they do not widen.
- **D5 – A parent in the filter.** (a) `Places/Italy` matches its descendants.
- **D6 – Tag list.** (a) Tags read from the user's sidecars plus those they created, kept per
  user.
- **D7 – Managing tags** (rename, move, delete across pictures). (a) Not in the first version.
- **D8 – Touch entry point.** (a) An icon button *Tags* in the action bar, plus the visible
  *Select* button of the approved mockup, with long-press as a shortcut.
- **D9 – Foreign keywords in `dc:subject`.** (a) Keep them.

## Proposed glossary entries

Added to [`04-glossary.md`](04-glossary.md) with step 2.

| Term | Meaning |
|---|---|
| **tag** | A path of names, `Places/Italy/Dolomites`, given to a picture; digiKam's tag. |
| **tag list** | Every tag the user has, offered by the tag entry and the filter. |
| **tag entry** | The field `T` opens, with autocomplete, to add and remove tags. |

UI words: *Tags*, *Add a tag*, *Create tag …*, *Untagged*; toasts "Tagged …" and "Removed …
from …". The action is *Tag*, never *keyword* or *label* (a label is a colour label).

## Implementation outline

Each step is one pull request with its spec and tests.

1. ADR: the tag table (per user: picture tags and tag list) and the endpoint shape (ADR 0022,
   `TAGS-001`).
2. `src/logic/xmp/`: read and merge tags (fixtures for each field, union, change applied to the
   current set, foreign keywords). Spec `XMP-004`.
3. Backend: store and list tags beside the decisions (`TAGS-001`); sidecar writes carry them.
4. Tag entry and `T` in the key map (`KEYS-001`), bulk tagging (`GRID-003`).
5. Tag filter (`GRID-002`, all tags must match), tile and info panel.
6. Mockup: merge `tag-entry.html` into `index.html`; user doc `user/tags.md`.
