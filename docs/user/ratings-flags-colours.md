# Ratings, flags and colour labels in other programs

honeycomb keeps your decisions — stars, flags and colour labels — and writes them into the XMP
sidecar files next to your photos (`IMG_0001.NEF.xmp` or `IMG_0001.xmp`). honeycomb rates only what
it can write, so a photo in a folder you may only read cannot be rated. Setting anything on a photo
updates the sidecars it already has, and a file without one gets a new `IMG_0001.NEF.xmp`. A photo
you have not touched gets none. digiKam, darktable and Lightroom Classic read those files, so a
photo you rated on the iPad shows the same stars on your desktop. When you open a folder for the
first time, honeycomb also picks up what these programs have already written.

While you stay on a photo, honeycomb collects your changes and writes them once you move on, or
after two seconds without a change. Until then the grid tile shows a small white ring next to the
stars. Leaving the page, deleting and moving write what still waits first.

Deleting goes by the sidecars as they are now, not as honeycomb last saw them. [*Review rejects*](deleting.md)
deletes a photo only when every sidecar of it still says rejected, and *Remove RAWs* only when none
says *Keep RAW* or rejected. If someone changed a sidecar on the desktop in between, the photo is
skipped and the report says why; reload the folder to see its current state. A deleted photo takes
its sidecars into the trash bin with it. Before a RAW goes, its values are copied into the JPEG's
own sidecar, so nothing you decided is lost; if that sidecar cannot be written, the RAW stays.

The technical details are in [`../06-xmp-interop.md`](../dev/06-xmp-interop.md).

**Changing in the next release** ([ADR 0040](../dev/adr/0040-flags-per-picture-in-the-database.md)).
Writing needs no setting any more; stars and colour labels go into the sidecars at once, flags
and *Keep RAW* only through *Write picks/rejects to XMP* in the ⋯ menu. digiKam sees honeycomb's
picks and rejects only after that, and until then may still show an old pick of its own.

## What each program sees

| In honeycomb | digiKam | darktable | Lightroom Classic |
|---|---|---|---|
| 1–5 stars | the same stars | the same stars | the same stars |
| **Picked** | Accepted | nothing (darktable has no picks) | Picked (13.2 and later) |
| **Rejected** | Rejected | Rejected | Rejected (13.2 and later) |
| **Unflagged** | no pick label | not rejected | unflagged |
| a colour label | the same colour | red, yellow, green, blue and purple only | the label's name, e.g. "Red" |

honeycomb's colours are digiKam's nine: red, orange, yellow, green, blue, magenta, gray, black and
white. Magenta is called "Purple" in darktable and Lightroom.

## digiKam settings

digiKam sees honeycomb's decisions only when it reads sidecars, which it does not do by default.
In digiKam 8, under **Settings → Configure digiKam → Metadata** (the wording may differ between
versions):

- **Behavior:** turn on writing for rating, pick label, colour label and tags.
- **Sidecars:** turn on *Read from sidecar files* and *Write to sidecar files*, with *Write to XMP
  sidecar only* or *Write to image and XMP sidecar*. Leave the option for sidecar file names
  compatible with commercial programs off: digiKam then reads `IMG_0001.NEF.xmp`, the name
  honeycomb creates; with it on, digiKam reads only `IMG_0001.xmp` and ignores honeycomb's file.

Without *Read from sidecar files*, digiKam's own write replaces the sidecar and drops what it does
not know, such as *Keep RAW* and darktable's edit history.

digiKam picks up honeycomb's changes at its next scan of the folder. darktable reads a changed
sidecar only when its crawler runs (**Preferences → Storage → look for updated XMP files on
startup**, off by default) and you confirm the update.

## What can get lost

- **Stars on rejected photos.** darktable stores "rejected" in place of the stars, so a rejected
  photo has no stars in the sidecar. honeycomb remembers them; the other programs do not.
- **Picks in darktable.** darktable has no picked state; it sees a picked photo as not rejected.
- **Lightroom before Classic 13.2** keeps picks and rejects in its catalog only. honeycomb cannot
  see them, and Lightroom does not read honeycomb's. Since 13.2 (February 2024) Lightroom writes
  them to XMP, but it only saves a changed flag together with another change, and Adobe has not
  documented the field.
- **Colours darktable does not have.** Orange, gray, black and white show as no colour in
  darktable.
- **Lightroom and JPEG files.** As far as we know, Lightroom keeps a JPEG's metadata inside the
  JPEG and reads only `IMG_0001.xmp` next to a RAW file, so it may not see decisions made in
  honeycomb for JPEG-only photos.
- **digiKam's "Pending".** honeycomb shows a pending photo as unflagged and keeps it pending in
  the sidecar until you pick or reject it.
- **Tags** are a separate feature: see [tags](tags.md).
- **Keep RAW** is honeycomb's own marker. It is kept in the sidecar, but no other program shows
  it.

## Several colour labels from darktable

darktable lets a photo have more than one colour label; honeycomb shows one. It shows the first in
darktable's order — red, yellow, green, blue, purple — so a photo labelled blue and red appears
red. The other labels stay in the sidecar until you choose a colour label for that photo in
honeycomb; then darktable gets just that one label, matching what you see in honeycomb.

## When programs disagree

If a photo has two sidecars that disagree (one per file of a RAW+JPEG pair, or both
`IMG_0001.NEF.xmp` and `IMG_0001.xmp`), honeycomb uses the one changed most recently, and the RAW
file's sidecar if they were changed at the same time.

A JPEG without a sidecar of its own counts with the XMP stored inside it, as in digiKam; honeycomb
reads it but never changes the photo. When honeycomb gives such a JPEG its own sidecar, the stars,
flag and colour label of the embedded XMP move into it, so digiKam shows the same values.

Everything else in a sidecar — darktable's edit history, Lightroom's develop settings — stays as
it was when honeycomb writes it. Tags are the one other thing honeycomb writes ([tags](tags.md)).

## Shared folders

In a folder shared with you, or one you share — with other users, by public link or by mail, as a
group folder or on external storage several users mount — everyone with access sees the sidecars.
honeycomb writes there without asking, like anywhere you may change the folder. In a folder you may
only read nothing can be rated: a message says *Not changed: read only*, and the loupe's info
panel names the reason under *Written to*. A sidecar that cannot be written, because it is locked,
was changed by another program, is not XMP or the storage is full, is reported with its reason.

## When a sidecar cannot be written

If a sidecar cannot be written — you may not change it, it is locked, or it is not valid XML —
honeycomb says *Could not write 2 sidecars* and the reason. **Details** lists each file with the
reason, and **Retry failed sidecars** tries those files again. honeycomb never overwrites a
sidecar it cannot read; your decision stays in honeycomb either way.
