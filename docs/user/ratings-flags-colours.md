# Ratings, flags and colour labels in other programs

honeycomb keeps your decisions — stars, flags and colour labels — and writes them into the XMP
sidecar files next to your photos (`IMG_0001.NEF.xmp` or `IMG_0001.xmp`). digiKam, darktable and
Lightroom Classic read those files, so a photo you rated on the iPad shows the same stars on your
desktop. When you open a folder for the first time, honeycomb also picks up what these programs
have already written.

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
- **Tags** are not shown in honeycomb, and it never changes them.
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

Everything else in a sidecar — darktable's edit history, digiKam's tags, Lightroom's develop
settings — stays as it was when honeycomb writes it.

## Shared folders

In a folder shared with you, or one you share, honeycomb keeps your decisions to itself and writes
no sidecars on its own, since everyone with access would see them. To write them anyway, choose
**⋯ → Write decisions to sidecars…**: honeycomb names the photos and folders and, once you
confirm, writes the sidecars of every photo there that you have decided.

## When a sidecar cannot be written

If a sidecar cannot be written — you may not change it, it is locked, or it is not valid XML —
honeycomb says *Could not write 2 sidecars*. **Details** lists each file with the reason, and
**Retry failed sidecars** tries those files again. honeycomb never overwrites a sidecar it cannot
read; your decision stays in honeycomb either way.
