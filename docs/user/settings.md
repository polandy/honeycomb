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

## Keyboard

- **Vi keys:** `h` `j` `k` `l` switch photos, `g g` and `Shift+G` go to the first and last photo,
  `/` opens the filters. `g` then no longer opens the grid: `Esc` does. See
  [keyboard shortcuts](keyboard-shortcuts.md#vi-keys).
