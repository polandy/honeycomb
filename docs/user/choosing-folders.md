# Choosing folders

honeycomb culls a *folder set*: one or more folders you tick in the folder picker. It opens on
the first start and from *Change folders* in the grid's toolbar.

## The folder tree

The picker shows your Nextcloud folders as a tree, starting with the folders in your home
folder, shared folders included. A folder with subfolders has an arrow before it:

- **Expand or collapse:** tap or click the arrow. The subfolders are loaded the first time you
  expand a folder; if they cannot be loaded, expand it again to retry.
- **Tick:** tap or click the folder itself. Tick several folders to cull them together; the
  picker shows how many photos they hold before you open them.
- **Ticked below:** a folder with ticked folders somewhere inside it shows "*n* inside" after its
  name, also while it is collapsed, so you can find your ticks. The move dialog's *Browse…* marks
  the folders above the chosen one the same way.
- **Photo files:** the number at the end of a folder's row counts its photo files. While a
  folder is collapsed it counts the photo files in it and in all its subfolders; once you expand
  it, it counts only those directly in it, and each subfolder shows its own (as in digiKam). A RAW
  and a JPEG of one shot count as two, so it can be twice the number of photos the picker shows
  once you tick the folder. Folders without photo files show no number. The count of a collapsed
  folder comes from Nextcloud's file index, so files Nextcloud has not scanned yet are missing
  from it.
- **Include subfolders:** the switch above the tree adds every subfolder of a ticked folder, at
  any depth. Hidden folders (starting with a dot) are always skipped and cannot be ticked. With
  the switch on, ticking a subfolder of a ticked folder changes nothing: **Recent** keeps one
  entry and one position for both. While it is on, the folders below a ticked one show a dashed
  tick and "included"; tap one to tick it as well.

When you reopen the picker from a cull, the folders above the ticked ones start expanded, so you
see what you culled.

## Keyboard

The tree is one stop in the tab order.

| Key | Does |
|---|---|
| Up, Down | Move to the folder above or below |
| Home, End | Move to the first or last folder shown |
| Right | Expand the folder, or move to its first subfolder when it is expanded |
| Left | Collapse the folder, or move to the folder above it when it is collapsed |
| Enter, Space | Tick or untick the folder |
