# Ratings, flags and colour labels in other programs

honeycomb keeps your decisions — stars, flags and colour labels — and, once you turn it on, writes
them into the XMP sidecar files next to your photos (`IMG_0001.NEF.xmp` or `IMG_0001.xmp`).
Writing is off by default; choose it under **Settings → XMP sidecars**
([settings](settings.md#xmp-sidecars)). With *Only existing sidecars*, setting anything on a photo
— a flag, stars, a colour label or *Keep RAW* — updates the sidecars it already has; with
*Existing and new sidecars* a file without one also gets a new `IMG_0001.NEF.xmp`. A photo you have
not touched gets none. digiKam,
darktable and Lightroom Classic read those files, so a photo you rated on the iPad shows the same
stars on your desktop. When you open a folder for the first time, honeycomb also picks up what these
programs have already written.

The technical details are in [`../06-xmp-interop.md`](../06-xmp-interop.md).

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

Everything else in a sidecar — darktable's edit history, Lightroom's develop settings — stays as
it was when honeycomb writes it. Tags are the one other thing honeycomb writes ([tags](tags.md)).

## Shared folders

In a folder shared with you, or one you share — with other users, by public link or by mail, as a
group folder or on external storage several users mount — honeycomb keeps your decisions to itself
and writes no sidecars on its own, since everyone with access would see them. To write them anyway,
choose **⋯ → Write decisions to sidecars…**: honeycomb names the photos and folders and, once you
confirm, writes the sidecars of every photo there that you have decided. This works whatever the
setting; with *Only existing sidecars* it creates no new ones.

## When a sidecar cannot be written

If a sidecar cannot be written — you may not change it, it is locked, or it is not valid XML —
honeycomb says *Could not write 2 sidecars*. **Details** lists each file with the reason, and
**Retry failed sidecars** tries those files again. honeycomb never overwrites a sidecar it cannot
read; your decision stays in honeycomb either way.
