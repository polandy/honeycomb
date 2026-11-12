# Settings

Open *Settings* from the ⋯ menu of the grid's toolbar. Every change applies at once; there is no
OK button. The settings are yours alone and are stored in your Nextcloud account, so they follow
you to every device and browser. If a change cannot be saved, honeycomb says so and keeps it
until you reload the page.

## File types

honeycomb pairs a RAW file and a rendered file (a JPEG, HEIC and so on) with the same name,
ignoring case. *RAW extensions* and *Rendered extensions* list which file types count as which.

- Remove a type with its ✕. Each list keeps at least one type.
- Add a type by typing it (with or without the dot) and pressing *Add*. An extension has only
  letters and digits, may be in only one of the lists, and cannot be `xmp`: sidecars always go
  with their photo.

Changing a list pairs the open folders again at once; your decisions stay.

## Folder layout

- **Same folder:** the RAW and the rendered file lie side by side.
- **Separate subfolders:** the RAW lies in a subfolder (*RAW folder*, `RAW` by default) and the
  rendered file in a sibling subfolder (*Rendered folder*, `JPG` by default), for example
  `Trip/RAW/IMG_1.NEF` and `Trip/JPG/IMG_1.JPG`. Folder names are matched ignoring case; an empty
  name goes back to its default.
- **Show singles:** with it on, a JPEG without RAW or a RAW without JPEG stays in the grid. Turn
  it off to cull only pairs. The count in the folder picker still counts every photo.

## Loupe gestures

- **Swipe up** and **Swipe down:** each picks, rejects or does nothing. By default up picks and
  down rejects.
- **Auto-advance to the next undecided photo:** after a pick or reject the loupe goes to the next
  photo you have not decided yet. A rating or colour label never moves on. With it off, the loupe
  stays; `Shift` with a decision key still goes on.
- **Show flag buttons:** *Pick*, *Reject* and *Unflag* in the loupe. Hidden, the photo gets their
  room; the keys and swipes keep working, and the flag in the loupe's title row or `B` shows them
  again.
- **Pin the filmstrip** and **Pin the rating row:** keep the filmstrip, or the stars, colour
  labels and *Keep RAW*, below the photo in landscape instead of over it, so they never fade. Each
  is off by default; the pin in the loupe's title row switches the filmstrip's too.

## Keyboard

- **Vi keys:** `h` `j` `k` `l` switch photos, `g g` and `Shift+G` go to the first and last photo,
  `/` opens the filters. `g` then no longer opens the grid: `Esc` does. See
  [keyboard shortcuts](keyboard-shortcuts.md#vi-keys).

## Moving photos

- **Name template:** how a moved photo is named, relative to the folder you move it to. All files
  of a photo, sidecars included, get the same new name. Choose a preset (*By day*, *By day, full
  date in the name*, *Keep names*) or type your own; the tokens are described in
  [name templates](../05-name-templates.md). A valid template is saved as you type. An invalid one
  is marked where the problem is, and moving keeps using the last valid template.
- **Preview:** five sample photos show the names the template gives. Notes mark a name that
  collides and gets a `-2` suffix, a photo without an EXIF time (its file time is used) and one
  without a camera model (`unknown`).
- **Favourite folders:** the folders you starred in the move dialog. ✕ removes one; add them in
  the move dialog.
