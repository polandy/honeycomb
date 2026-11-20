# 6. XMP interop

How honeycomb reads and writes ratings, flags and colour labels in the XMP sidecars that digiKam,
darktable and Lightroom Classic use (Q2, Q3, milestone M5). Since ADR 0032 the sidecar is the source
of truth and digiKam compatibility comes first; since ADR 0040 that holds for rating, colour label
and tags, while the flag and *Keep RAW* live in the database (`honeycomb_flags`) and reach the
sidecars only through *Write picks/rejects to XMP*. Where a rule below has not landed yet, it names
the pull request of ADR 0032 or of M8 (ADR 0040) that brings it. The file rules are Framehive's
(CORE-009, LIBRARY-001), so a sidecar means the same in both apps; what honeycomb adds is marked.
The user-facing summary is [`user/ratings-flags-colours.md`](../user/ratings-flags-colours.md).

## Sources

Every field below was checked against these; anything not checked is marked **unverified**.

| Key | Source |
|---|---|
| digiKam | [digiKam](https://invent.kde.org/graphics/digikam) at `998e0459` (2026-11-09): `core/app/utils/digikam_globals.h`, `core/libs/metadataengine/dmetadata/dmetadata_labels.cpp`, `dmetadatasettingscontainer.cpp`, `engine/metaengine_fileio.cpp`; master (2026-11-15): `engine/metaenginesettingscontainer.cpp`, `engine/metaengine_p.cpp`, `core/libs/database/collection/collectionscanner_scan.cpp` |
| darktable | [darktable](https://github.com/darktable-org/darktable) at `0c23f000` (2026-11-08): `src/common/exif.cc`, `image.c`, `colorlabels.h`; master (2026-11-15): `src/control/crawler.c`, `data/darktableconfig.xml.in` |
| ExifTool | [ExifTool](https://github.com/exiftool/exiftool) at `9b8664df`: `lib/Image/ExifTool/XMP.pm`, `XMP2.pl` |
| Lightroom | Adobe community reports on Lightroom Classic 13.2 (Feb 2024): [flags in XMP](https://community.adobe.com/t5/lightroom-classic-discussions/lrc-v13-2-and-flags-in-xmp/m-p/14440118), [`xmpDM:pick` bug](https://community.adobe.com/t5/lightroom-classic-bugs/flag-not-saved-to-xmp-if-xmp-pick-missing-from-file-metadata/idi-p/14479660) |
| Framehive | `specs/core/CORE-009-xmp-sidecars.md`, `specs/library/LIBRARY-001-raw-jpeg-grouping.md` at `23d08a8` (2026-11-08) |

## Namespaces

Properties are matched by namespace URI, never by prefix (CORE-009.6).

| Prefix | URI | Checked in |
|---|---|---|
| `xmp` | `http://ns.adobe.com/xap/1.0/` | ExifTool `XMP.pm:138` |
| `xmpDM` | `http://ns.adobe.com/xmp/1.0/DynamicMedia/` | ExifTool `XMP.pm:140` |
| `digiKam` | `http://www.digikam.org/ns/1.0/` | ExifTool `XMP.pm:175` |
| `darktable` | `http://darktable.sf.net/` | darktable `exif.cc:6788` |
| `lr` | `http://ns.adobe.com/lightroom/1.0/` | ExifTool `XMP.pm:158` |
| `dc` | `http://purl.org/dc/elements/1.1/` | ExifTool, CORE-009.6 |
| `honeycomb` | `https://github.com/polandy/honeycomb/xmp/1.0/` | honeycomb's own (ADR 0008) |

## Field mapping

| honeycomb | digiKam | darktable | Lightroom Classic |
|---|---|---|---|
| rating 0–5 | `xmp:Rating` 0–5 | `xmp:Rating` 0–5 | `xmp:Rating` 0–5 |
| flag *rejected* | `digiKam:PickLabel` 1 | `xmp:Rating` −1 (read only; honeycomb writes digiKam's form, ADR 0032) | `xmpDM:pick` −1, `xmpDM:good` `False` (13.2+) |
| flag *picked* | `digiKam:PickLabel` 3 | – (no picks) | `xmpDM:pick` 1, `xmpDM:good` `True` (13.2+) |
| flag *unflagged* | `digiKam:PickLabel` 0 or absent | rating ≥ 0 | `xmpDM:pick` 0 or absent |
| (digiKam's *pending*) | `digiKam:PickLabel` 2 | – | – |
| colour label | `digiKam:ColorLabel` 0–9 and `xmp:Label` text | `darktable:colorlabels`, a `rdf:Seq` of 0–4, several allowed | `xmp:Label` text |
| *Keep RAW* | – | – | – |
| (tags) | `digiKam:TagsList` `a/b/c` | `lr:hierarchicalSubject` `a\|b\|c`, `dc:subject` | `lr:hierarchicalSubject` `a\|b\|c`, `dc:subject` |

Evidence, one line per claim:

- **digiKam pick label:** `NoPickLabel` 0, `RejectedLabel` 1, `PendingLabel` 2, `AcceptedLabel` 3
  (`digikam_globals.h:138`). digiKam also reads and writes `xmpDM:pick` (1 accepted, −1 rejected)
  and `xmpDM:good` (`True`/`False`, case-insensitive), in that order after `PickLabel`, and
  removes all three when the label is none (`dmetadata_labels.cpp:71–100, 322–370`,
  `dmetadatasettingscontainer.cpp:568`).
- **digiKam colour label:** 0 none, 1 red, 2 orange, 3 yellow, 4 green, 5 blue, 6 magenta,
  7 gray, 8 black, 9 white (`digikam_globals.h:119`). Read order `digiKam:ColorLabel`,
  `xmp:Label`, `photoshop:Urgency` (`dmetadatasettingscontainer.cpp:599`). `xmp:Label` is written
  as `NoColor`, `Red`, `Orange`, `Yellow`, `Green`, `Blue`, `Purple`, `Gray`, `Black`, `White`,
  so magenta is `Purple` (`digikam_globals.h:88`, `dmetadata_labels.cpp:427`); reading matches
  that list exactly, case-sensitive (`dmetadata_labels.cpp:176`).
- **digiKam rating:** `xmp:Rating` first (`dmetadatasettingscontainer.cpp:442`); a value outside
  0–5, such as darktable's −1, is not a rating, and a real number in between is rounded down
  (`dmetadata_labels.cpp:245–282`).
- **digiKam tags:** `digiKam:TagsList` (`rdf:Seq`, `/`), then `lr:hierarchicalSubject`
  (`rdf:Bag`, `|`), then `dc:subject` (`dmetadatasettingscontainer.cpp:311–358`).
- **darktable rating and reject:** writes `xmp:Rating` −1 for a rejected image, else 0–5; reads
  −1 as rejected (`image.c:980–1009`). No pick state exists.
- **darktable colour labels:** red 0, yellow 1, green 2, blue 3, purple 4 (`colorlabels.h:27`),
  written as a `rdf:Seq` of all the image's labels (`exif.cc:5625–5642`). On reading,
  `xmp:Label` (`Red`, `Yellow`, `Green`, `Blue`, `Purple`) wins; `darktable:colorlabels` is read
  only when `xmp:Label` is absent, and an unknown `xmp:Label` text gives no label at all
  (`exif.cc:698–720`). darktable never writes `xmp:Label`.
- **darktable tags:** `lr:hierarchicalSubject`, else `dc:subject` (`exif.cc:730`).
  **`darktable:tagsList` does not exist** in darktable's source; the brief's name was wrong.
- **darktable rewrites:** it decodes the existing sidecar, drops only its own keys
  (`dt_xmp_keys`, `exif.cc:446`) and writes them anew, so foreign properties such as
  `digiKam:*` survive (`exif.cc:530, 6581–6680`). `xmp:Label` is not one of its keys: a stale one
  stays.
- **Lightroom rating:** `xmp:Rating` is a real, 0–5 or −1 for rejected (ExifTool `XMP.pm:1060`).
  Lightroom writing −1 itself is **unverified**.
- **Lightroom flags:** before Classic 13.2 they lived in the catalog only. Since 13.2 Lightroom
  reads and writes `xmpDM:pick` (−1, 0, 1) and `xmpDM:good` (ExifTool `XMP2.pl:172`,
  ref. forum 15815; Adobe community reports above). Adobe's own namespace docs do not list
  `xmpDM:pick`, and the known 13.2 bug writes the flag only together with another change.
  **Unverified** against an Adobe document.
- **Lightroom colour label:** `xmp:Label` holds the label's *text* from the active label set;
  the default set's names `Red`, `Yellow`, `Green`, `Blue`, `Purple` are what darktable and
  digiKam exchange with it (`exif.cc:698`, `dmetadata_labels.cpp:429`). How Lightroom shows a
  text outside its set is **unverified**.
- **digiKam reads sidecars only when told to:** *Read from sidecar files* is off by default, and
  digiKam writes nothing by default; switched on, the target is *file only*
  (`metaenginesettingscontainer.cpp:34–56`). Once it reads a sidecar it ignores the embedded XMP
  completely (`metaengine_p.cpp:1036–1045`), which is honeycomb's "sidecar before embedded". Without
  reading, its own sidecar write replaces the file from memory, so foreign properties such as
  `honeycomb:KeepRaw` and darktable's history are lost (`metaengine_p.cpp:154–190, 406`).
- **digiKam rescans** a sidecar whose mtime is newer than its image's
  (`collectionscanner_scan.cpp:936–975`), so honeycomb's writes arrive at its next scan.
- **digiKam's extra copies:** it also writes the rating to `MicrosoftPhoto:Rating` and
  `acdsee:rating`, the colour to `photoshop:Urgency` and tags to five more fields
  (`dmetadata_labels.cpp:473–475`, `dmetadatasettingscontainer.cpp:305–380`). honeycomb leaves
  them as they are; digiKam reads `xmp:Rating`, `ColorLabel` and `TagsList` first, so a stale copy
  is not seen.
- **darktable rereads** a changed sidecar only through its crawler (`run_crawler_on_start`, off by
  default) and after the user confirms it in a dialog; its next own write sets `xmp:Rating` from
  its database again (`crawler.c:276, 1378–1391`, `exif.cc:5704`, `darktableconfig.xml.in:4084`).
- **Lightroom sidecar name:** Lightroom uses `IMG_0001.xmp` for proprietary RAW files and embeds
  XMP in JPEG, so it does not read `IMG_0001.NEF.xmp` or `IMG_0001.JPG.xmp`. **Unverified**
  against Adobe docs.

Framehive specifies no rating, flag or colour-label mapping yet (CORE-009, "Out of scope"); this
table is offered to it.

## Sidecar names

Same as Framehive (CORE-009 "Sidecar names", LIBRARY-001 "Metadata"):

- **Two namings:** `IMG_0001.NEF.xmp` (with extension; the default of digiKam, darktable and
  Framehive: digiKam `metaengine_fileio.cpp:42–59`, darktable `image.c:2104`) and `IMG_0001.xmp`
  (without; digiKam's "compatible file name", Adobe's convention). In the second, the members of a
  pair share one sidecar, which counts as the sidecar of each.
- **Reading** looks for both, extension `xmp` in any case (CORE-009.20). digiKam reads exactly
  one: the name its *compatible file name* setting gives, with no fallback to the other
  (`metaengine_fileio.cpp:42–59`, `collectionscanner_scan.cpp:716–733`).
- **Writing** goes to every rateable picture, without a setting (ADR 0040, XMP-008). It goes to every
  sidecar of the picture that exists, so none is left stale. When
  a member has none, honeycomb creates `<member file>.xmp` (CORE-009.21, `original_with_extension`,
  digiKam's default), one per member (LIBRARY-001.6).
- darktable's duplicates (`IMG_0001_01.NEF.xmp`, `image.c:930`) belong to darktable versions,
  not to members: honeycomb neither reads nor writes them, and deletes them with the picture.
  *Added; Framehive does not mention them.*
- **Owner.** Which picture a sidecar belongs to, also for ambiguous base names, is decided by
  pairing (`src/logic/sidecars.ts`, [`decisions.md`](decisions.md)).
- **Deleting a picture** removes every member and every sidecar form: each `<member file>.xmp`,
  the darktable duplicates and the shared `<base>.xmp`. A shared `<base>.xmp` is removed only when
  no member of the picture remains. **Remove RAWs** removes the RAW member and only its own
  `<raw file>.xmp`; the JPEG's `<file>.xmp` and a shared `<base>.xmp` stay
  ([`plan.md`](plan.md#keep-raw-and-remove-raws)).

## Reading

**When.** The sidecar is the source of truth for rating, colour label and tags (ADR 0032, ADR
0040); the flag and *Keep RAW* it states are taken over once, for a picture without a row in
`honeycomb_flags` (XMP-003.34, M8 PR 6). Every source file is read once per
ETag: a per-user cache (`honeycomb_xmp_cache`, XMP-006) holds the values derived from each
sidecar or embedded packet, and a file is read again when its listed ETag differs, so a change in
digiKam shows at the next folder visit. A sidecar that is read hides the JPEG's embedded XMP
completely, as in digiKam. Until ADR 0032 PR 6, the database is still the working state: a
picture's sidecars are read only when honeycomb has no decision stored for it.

**Parsing** follows CORE-009 "Reading": every RDF form (attributes, elements, nested and several
`rdf:Description`, `rdf:parseType="Resource"`, `<?xpacket?>` wrapper or none, bare `rdf:RDF`).
A sidecar is refused, reported per file and never overwritten, when it is not well-formed, not
UTF-8, has a `<!DOCTYPE>`, or gives one property two values (CORE-009.11–.15).

**One sidecar → one decision.** Each value is taken from the first source that has a valid value:

| Value | Order |
|---|---|
| flag | `digiKam:PickLabel` 0–3 (2 pending → *unflagged*) · `xmpDM:pick` 1/−1 (0 is skipped, as in digiKam) · `xmpDM:good` `True`/`False` · `xmp:Rating` −1 → *rejected* · else *unflagged* |
| rating | `xmp:Rating` 0–5, a real rounded down; −1 or out of range → 0 |
| colour label | `digiKam:ColorLabel` 0–9 · `xmp:Label` (digiKam's ten texts, exact case; `NoColor` → none) · `darktable:colorlabels` → the lowest index · else none |
| *Keep RAW* | `honeycomb:KeepRaw` `True` (any case) → marked · else not marked; ignored for a single |

The order is digiKam's for flags and colour labels, so where digiKam has a pick label honeycomb
never shows a picture as rejected that digiKam does not, which matters before "delete
rejected". `xmp:Rating` −1 is added at the end for darktable, which digiKam reads as no rating. An
`xmp:Label` text honeycomb does not know (a custom Lightroom label set) is skipped like an absent
one. *Added:* digiKam would fall through to `photoshop:Urgency`, which honeycomb ignores.

**Several darktable labels.** honeycomb has one colour label per picture, so it takes the lowest
darktable index (red, yellow, green, blue, purple), which does not depend on the order darktable
happens to write them in. The others stay in the sidecar until the user changes the colour label
in honeycomb (see Writing).

**The embedded XMP.** A JPEG without a sidecar of its own (neither `<JPEG file>.xmp` nor the
shared `<base name>.xmp`) states its values through its embedded XMP packet (ADR 0023): it is read
by the same rules, as the JPEG's sidecar with the JPEG's modification time, and never written.
When honeycomb creates the JPEG's sidecar, the new sidecar starts from the decision the embedded
XMP states, so digiKam, which then reads only the sidecar, loses no value (see Writing).

**Several sidecars of one picture.** When they disagree, the most recently modified sidecar wins
as a whole, a tie goes to the RAW member's sidecar, and the conflict is logged (LIBRARY-001.8).
The embedded XMP counts as one of them. The modification time comes from `OCP\Files`
(`Node::getMTime()`). Framehive's conflict badge is
a UI choice honeycomb has not made.

## Writing

**Merging** follows CORE-009 "Merging": honeycomb sets only the properties below and keeps every
other property, qualifier and value text, including darktable's history, digiKam's `TagsList`,
Camera Raw settings and unknown namespaces (CORE-009.3, .23).

| Property | Written | Value |
|---|---|---|
| `xmp:Rating` | always | rating 0–5, also when *rejected*; never −1 (ADR 0032) |
| `digiKam:PickLabel` | always; from M8 PR 6 only by *Write picks/rejects to XMP* | 3 *picked*, 1 *rejected*; *unflagged* removes it, but an existing 2 (pending) stays |
| `xmpDM:pick` | as `digiKam:PickLabel` | 1 *picked*, −1 *rejected*; removed when *unflagged*, as digiKam does |
| `xmpDM:good` | as `digiKam:PickLabel` | `True` *picked*, `False` *rejected*; removed when *unflagged* |
| `digiKam:ColorLabel` | always | 0–9; 0 for none, so digiKam does not fall through to `photoshop:Urgency` |
| `xmp:Label` | always, except in a darktable sidecar that lacks it | digiKam's text (`Purple` for magenta); removed for none |
| `darktable:colorlabels` | only in a darktable sidecar, only when the colour label changed | a `rdf:Seq` with the one darktable index; removed for none and for orange, gray, black and white |
| `honeycomb:KeepRaw` | always, for a pair; from M8 PR 6 as `digiKam:PickLabel` | `True` when marked *Keep RAW*; removed when not marked |
| tags | not yet on a change; the module is ready (XMP-004) | `digiKam:TagsList`, `lr:hierarchicalSubject`, `dc:subject` ([`07-tags.md`](07-tags.md)) |

From M8 PR 6 a rating, colour label or tag write leaves the three flag fields and
`honeycomb:KeepRaw` as the sidecar holds them, and *Write picks/rejects to XMP* writes those four
alone, into each sidecar of a rateable picture that differs from the database; it creates a
sidecar only for a picture that is flagged or marked *Keep RAW* (XMP-003.37–.41, ADR 0040).

A **darktable sidecar** is one with `darktable:xmp_version`. digiKam's fields are written always
because digiKam is the target of M5; darktable's only where darktable already wrote.

- `xmp:Label` stays out of a darktable sidecar because darktable reads it before
  `darktable:colorlabels` but never updates it: once written, darktable would show it forever.
  Where it is already present, honeycomb keeps it in step.
- A changed colour label replaces darktable's whole list with one label, so what darktable shows
  is what honeycomb shows. The label counts as changed when it differs from the one the sidecar
  states (Reading); an unchanged one leaves the list alone.
- A rejected picture keeps its stars in `xmp:Rating` and is rejected through the pick fields,
  digiKam's way, also in a darktable sidecar; darktable then does not see the reject (owner,
  2026-11-15). A sidecar with `xmp:Rating` −1 gets the picture's stars 0–5 on any write, and a
  reject that stays moves to the pick fields.
- **Deltas** (ADR 0032): a change carries only the fields it sets; per sidecar it is applied
  to the decision that sidecar reads as, and the whole set above is written from the result, so
  fields the change does not touch keep each sidecar's own value. A new sidecar reads as what the
  picture's sources state; the JPEG's new sidecar reads as its embedded XMP, while that has a
  packet. A new sidecar gets the decision fields also from a tag change.

**Serializing and saving** follow CORE-009 "Writing" and "Saving", so honeycomb and Framehive write
the same bytes for the same model: Framehive's canonical form (CORE-009.4, .5), preferred prefixes
and a clashing prefix renamed (CORE-009.6, .7), `xmp:MetadataDate` set on every write from the
injected clock, never `xmp:CreatorTool`, `xmp:ModifyDate` or `xmpMM:History` (CORE-009.10). Saving
goes through `OCP\Files` (CLAUDE.md rule 1): check the target has not appeared or changed since it
was read, then write it in place (ADR 0017). Until M8 PR 3 an existing sidecar is replaced only
while the Versions app is enabled for the user; ADR 0040 drops that rule, so a sidecar on external
storage is overwritten too, and the delta write keeps the other programs' fields (XMP-002.11). A
full storage or quota answers `noSpace` (M8 PR 6). *Differs:* the check uses the Nextcloud ETag and
size in place of BLAKE3, and the write is no part file and rename (CORE-009.16–.19): Nextcloud
35.0.3 refuses to move a part file, and the replaced bytes are kept as a version instead. Reading,
the mapping and serializing are a pure TypeScript module, `src/logic/xmp/` (XMP-001); the backend
only reads the bytes and does the checked save (ADR 0006, endpoints in ADR 0017 and XMP-002).
`@xmldom/xmldom` turns the bytes into an element tree (ADR 0016). In it, `parse.ts` (the only
importer of xmldom) and `rdf.ts` read, `decision.ts` maps a packet to a decision and picks the
deciding sidecar, `merge.ts` merges and writes, `serialize.ts` writes the canonical form and
`targets.ts` names the sidecars a write goes to.

## Test vectors

Synthetic sidecars written from the sources above, not exported from the programs, in
[`tests/fixtures/xmp/`](../../tests/fixtures/xmp/); the expected values are in `expected.json` there.

| Fixture | Shows | Rating | Flag | Colour label |
|---|---|---|---|---|
| `digikam.xmp` | digiKam's fields as attributes, `<?xpacket?>`, tags in three forms | 3 | picked | blue |
| `digikam-pending.xmp` | pending, magenta as `Purple` | 0 | unflagged | magenta |
| `darktable.xmp` | rating −1, two labels `[3, 0]`, history | 0 | rejected | red |
| `darktable-label-precedence.xmp` | `xmp:Label` beats `darktable:colorlabels` | 2 | unflagged | green |
| `lightroom.xmp` | elements form, `xmpDM:pick` −1, `crs:` settings | 4 | rejected | yellow |
| `lightroom-no-flag.xmp` | real rating 2.5, custom label text | 2 | unflagged | none |
| `conflict.xmp` | two `rdf:Description` with ratings 2 and 4 | refused | | |
| `corpus/lightroom-classic.xmp` | Lightroom Classic: `<?xpacket?>` with padding, `crs:` settings, `crs:Look` struct, `xmpMM:History` | 3 | unflagged | red |
| `corpus/capture-one.xmp` | Capture One: IPTC contact struct as `rdf:parseType="Resource"`, a two-language `dc:description` | 5 | unflagged | green |
| `corpus/on1.xmp` | ON1 Photo RAW: elements form, `dc:title`, `lr:hierarchicalSubject` | 2 | unflagged | blue |
| `corpus/photo-mechanic.xmp` | Photo Mechanic: `photomechanic:` color class and tag, `photoshop:Urgency` beside `xmp:Label` | 1 | unflagged | yellow |
| `corpus/darktable-history.xmp` | darktable with four history items, a mask and its hashes | 4 | unflagged | magenta |

The corpus under `corpus/` is synthetic too, written after each program's documented fields;
XMP-001.22 writes three decisions in turn into each and checks that every property honeycomb does
not write keeps its value and qualifiers. The bytes still change: honeycomb writes its canonical
form, without the wrapper, padding, `x:xmptk` or comments, which is why a replace needs file
versions.

**Canonical form, a decision (2026-11-20):** honeycomb writes no `<?xpacket?>` wrapper and no
padding, also into a sidecar that had them. The wrapper and padding let a program edit a packet
embedded in another file in place; a sidecar is a file of its own. ExifTool and Exiv2 read the form
back (below), and digiKam reads through Exiv2. The cost is a rewritten file and a
larger diff in file versions and sync on the first write into a foreign sidecar. Keeping a foreign
wrapper would make the bytes depend on the file read and leave honeycomb and Framehive writing
different bytes for one model (CORE-009.4). Lightroom reading it is unverified, like its sidecar
name.

**Read back with real tools.** The fixtures are synthetic, so `tests/interop/` writes sidecars with
honeycomb's writer and reads them back with `exiftool -j -G1 -n -XMP:all` and `exiv2 -pa`
(XMP-001.25, .26). Each case states digiKam's values as constants of their own, not through
honeycomb's mapping, so a wrong value, a wrong namespace URI or a lost foreign property fails it.
`scripts/xmp-interop.sh` runs it in a container with both tools; `scripts/verify.sh` and CI run it
on every TypeScript change, and the nightly workflow runs it against the tools as Debian ships them
that day.

Write cases for M5, on top of CORE-009's:

1. **Unknown fields survive.** Rejecting `darktable.xmp` again, then picking it, keeps
   `darktable:history`, `lr:hierarchicalSubject` and `dc:subject` value for value.
2. **Several darktable labels.** Setting green on `darktable.xmp` gives `darktable:colorlabels`
   `[2]` and no `xmp:Label`; leaving the label alone keeps `[3, 0]`.
3. **Pending stays.** Rating `digikam-pending.xmp` 4 keeps `digiKam:PickLabel` 2.
4. **Pair.** A picture `IMG_0001.NEF` + `IMG_0001.JPG` with `IMG_0001.NEF.xmp` only: a decision
   updates it and creates `IMG_0001.JPG.xmp`. With `IMG_0001.xmp` only: just that file changes.

**Shared fixtures.** Framehive's TODO asks the owner to export real darktable and digiKam
sidecars (cleaned, CC0) for CORE-009.23. honeycomb uses the same files: once they land in
Framehive's `crates/adapters/xmp/tests/fixtures/`, they are copied byte for byte into
`tests/fixtures/xmp/exported/` with their expected values, and replace the synthetic ones where
they disagree.
