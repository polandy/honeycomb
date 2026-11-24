# Culling a shoot

One pass through a shoot, from choosing the folders to deleting the rejects. Every step also has
keys: [keyboard shortcuts](keyboard-shortcuts.md).

**Changing in the next release** ([ADR 0040](../dev/adr/0040-flags-per-picture-in-the-database.md)):
no setting needs turning on before the first rating; a photo in a folder you may not change shows
a lock.

## 1. Before the first cull

honeycomb rates only what it can write into the photos' XMP sidecars, so you can rate photos in
folders you may change; in a folder you may only read you can look, compare and move, but not
rate. What that changes in your files: [sidecars](sidecars.md).

## 2. Choose the folders

Open **honeycomb** in Nextcloud's navigation. The first time, *Where is your library?* asks for
the folders that hold your photos; add them as roots and press *Show folders*. Later, *Folders*
lists the folders below your roots worth culling, and *Cull* opens one; *Back to folders* returns
to the list. To cull any other folders, the navigation's *Folder* opens the folder picker: tick one
or more folders, with or without their subfolders ([choosing folders](choosing-folders.md)).
*Change folders* opens it again, and **Recent** in the navigation lists your last folder sets
with how many photos are decided.

## 3. Look through the grid

The grid shows every photo of the folder set as a thumbnail; a RAW and a JPEG with the same name
are one photo. The toolbar shows the progress (*x of y decided*) and the flag chips **Picked**,
**Unflagged** and **Rejected**; by default rejected photos are hidden. **Filters** opens the
filter bar for rating, colour label, pairing, *Keep RAW*, tags and folder. The ⋯ menu sets the
thumbnail size and the sort order (*File name* or *Capture time*).

An empty grid says why and offers a way out: *Change folders* when the folders hold no photos,
with a pointer to the *File types* setting, *Clear filters* when a filter hides every photo, and
*Show all* when only the flag filter does.

A tile shows its stars, colour label and flag once you decided it, and badges for a photo without
a partner (*JPG only*) and a pair marked *Keep RAW*.

A honey **bracket** above the tiles marks every series ([similarity](similarity.md)), like the
frame in the loupe's filmstrip: it spans the gaps between the tiles, continues onto the next row
and has a cap at the series' first and last photo. A series you have finished (every photo flagged,
or *Series done*) keeps a faded bracket; a dashed one may still change while the photos are
compared. The first tile under a bracket shows a badge, *⧉ 5* for a series of five, or *⧉ 2 of 5*
when another sort order or a filter splits it and only two of its photos stand together. A tap on
the badge opens the series compare on that series; in selection mode it selects the whole series,
and a second tap deselects it. `Alt+←` and `Alt+→` move the focus to the previous or next series.

**⋯ → Show file names** (or `Shift+J`) puts each photo's name above its tile; the setting is kept
for your account. With a mouse, rest the pointer on a tile for a moment to see its full name, the
capture time, the camera and the rating; moving away, clicking, scrolling or `Esc` hides it. On a
touch screen, tap the ⓘ button at the end of the name bar instead; tap it again, tap beside it,
scroll or press `Esc` to close it. A long-press on the tile still selects it.

To decide many photos at once, press **Select** (or long-press a tile), select photos and use the
action bar: flag, rating, colour label, *Keep RAW*, **Tags**, **Series…**, **Move…** and
**Delete**. **Done** leaves the selection.

## 4. Decide in the loupe

Tap a tile to open the **loupe**: one photo full screen.

- **Page** with a sideways swipe, a tap on the left or right edge, or `←` `→`.
- **Zoom** with a pinch, a double-tap or `Z`; drag to pan.
  For a picture that is only a RAW file, 100 % shows the *embedded preview* the camera stored in
  the RAW, not a full development of it, and the title row says so. That is enough to judge sharpness
  and focus, which is what honeycomb is for; a picture with a JPEG shows the JPEG.
- **Decide** with the **Pick**, **Unflag** and **Reject** buttons, by swiping up (pick) or down
  (reject), or by keys. Below the photo you set stars, a colour label and *Keep RAW*. After a pick
  or reject the loupe goes on to the next undecided photo; the settings change the swipes and
  turn this off.
- **Info** (`I`) shows the photo's files, its decision and tags.
- The **filmstrip** shows the photos around the current one; a honey frame marks a series.

Every decision shows a message with **Undo**. `Esc` returns to the grid at the photo you saw last.
When you open the folder set again, on any device, *Continue where you left off* offers
**Resume**; the ⋯ menu keeps *Resume at …*.

Reloading the browser page opens the same folder set again, and the loupe at the same photo when it
was open; the page address holds both. When a move or delete fails or skips a photo because the folder
changed, the message offers **Reload folder**, which lists the folder set again.

## 5. Compare series

Photos of a burst form a **series** ([similarity](similarity.md)). **Compare series** in the
toolbar, or `N`, shows one series at a time side by side; in the loupe the chip *⧉ Series 2/5*
opens the series of the shown photo.

- Tap a photo to make it the active one, ⤢ or a double-tap shows it full screen.
- **Pick this, reject the rest** (`Shift+K`) keeps the active photo and rejects the others in one
  step. **Skip** goes to the next series.
- honeycomb measures the sharpness of each photo of a series and marks the clearly sharpest one
  *Sharpest*; the mark is a hint only, it picks nothing.
- **⋯ → Reduce series to the sharpest…** in the grid takes that step for every series with a
  *Sharpest* photo at once: review the list, tap a photo to leave its series out, and confirm to
  pick each sharpest photo and reject the rest. Series without a clear sharpest stay for you to
  compare; `Ctrl+Z` takes the whole step back.
- **⋯ → Series done** marks a series as dealt with without deciding every photo: its unflagged
  photos stay unflagged but count as decided, and the series leaves the compare. Choose
  *Series done* again, from the loupe's series chip, to reopen it.
- The same ⋯ menu merges a series with the next or previous one or dissolves it. In the grid,
  **Series…** in the action bar corrects series by hand; select photos of one series and choose
  *Series done* there, or *Reopen series* when it is done.

## 6. Delete the rejects

Open **⋯ → Review rejects**, or press `Ctrl+Backspace`. Rescue any photo you rejected by mistake,
check the summary, and the rejected photos go with all their files to the Nextcloud trash bin
([deleting photos](deleting.md)).

To keep only the JPEGs of the photos you do not edit, **⋯ → Remove RAWs…** moves the RAW files
(and their own sidecars) of every pair that is neither rejected nor marked *Keep RAW* to the trash
bin.

## 7. Move the keepers

**⋯ → Move picks…** moves every picked photo, **Move…** in the action bar or `M` the selection.
Choose a target folder (favourites and recent folders come first, *Browse…* opens the picker),
check the new names, which follow the name template in the [settings](settings.md#moving-photos),
and decide what happens when a name is taken: *Add suffix*, *Skip* or *Replace*. Every file of a
photo moves together, with its decision. The message after the move offers **Undo**; `Ctrl+Z` does
not undo a move. A photo stays where it is when the move would take it out of its share or
storage. *Replace* sends the old file to the Nextcloud trash bin; when the trash bin would not keep
it (its storage has none, or it is larger than the trash bin allows), a warning names it first:
*Replace permanently* deletes it for good and moves the photo, which *Undo* cannot bring back;
*Cancel* leaves the photo where it is.
