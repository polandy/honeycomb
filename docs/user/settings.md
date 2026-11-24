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

## Library

- **Library roots:** the folders of your own files that *Folders* lists and counts. Tick a folder in
  the tree and press *Add as root*; remove a root with its ✕ button. Roots cannot be nested or
  repeated, and shares, group folders and external storage cannot be roots
  ([cleaning up the library](cleaning-up-the-library.md)).

## Loupe gestures

- **Swipe up** and **Swipe down:** each picks, rejects or does nothing. By default up picks and
  down rejects.
- **Auto-advance to the next undecided photo:** after a pick or reject the loupe goes to the next
  photo you have not decided yet. A rating or colour label never moves on. With it off, the loupe
  stays; `Shift` with a decision key still goes on.
- **Show flag buttons:** *Pick*, *Unflag* and *Reject* in the loupe and the series viewer: a row
  below the photo when the screen is taller than wide, otherwise *Pick* at the left edge, *Reject*
  at the right edge and *Unflag* at the bottom centre. Hidden, the photo gets their room; the keys
  and swipes keep working, and the flag in the loupe's title row or `B` shows them again.
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
  date in the name*, *Keep names*) or type your own. A template is text and `{tokens}` such as
  `{name}`, `{date:%Y-%m-%d}`, `{camera}` and `{ext}`, and `/` starts a new folder. A valid
  template is saved as you type. An invalid one is marked where the problem is, and moving keeps
  using the last valid template.
- **Preview:** five sample photos show the names the template gives. Notes mark a name that
  collides and gets a `-2` suffix, a photo without an EXIF time (its file time is used) and one
  without a camera model (`unknown`).
- **Favourite folders:** the folders you starred in the move dialog. ✕ removes one; add them in
  the move dialog.

## XMP sidecars

- **Write picks, rejects and Keep RAW to XMP sidecars:** on by default. Each pick, reject and
  *Keep RAW* goes into the photo's sidecars at once, and a pick or reject changed in digiKam is
  taken over the next time you open the folder ([sidecars](sidecars.md)). Turn it off to keep
  them in honeycomb alone; *Write picks/rejects to XMP* in the ⋯ menu then writes them when you
  choose. Stars, colour labels and tags are written either way.

## Statistics

- **Keep statistics:** on by default. honeycomb counts per day what you do, without file names;
  the [statistics page](statistics.md) shows it. Off, nothing new is counted.
- **Reset statistics:** removes every counter after a question; counting starts again today.

## Cache

- **Clear cache:** honeycomb remembers what it read from your XMP sidecars and JPEGs, so a folder
  opens fast. *Clear cache* removes that at once; the next visit of a folder reads its files
  again. The visual hashes and sharpness values of your photos stay, as every user who reaches
  a photo shares them. Your sidecars, decisions and tags stay. A message
  says when the cache is cleared or could not be.
- **Clean up orphaned data** (admins only): removes the picks and rejects of files that were
  deleted or lie in a trash bin, for every user, and says how many entries went.
