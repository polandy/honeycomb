# Keyboard shortcuts

honeycomb uses the Lightroom Classic Library keys wherever it has the same function, so if you
cull in Lightroom your hands already know them. The keys are the same on every screen: the grid,
the loupe, the series compare and the series viewer. On a Mac, `Ctrl` is `⌘`.

In the grid the keys act on the selection, or on the focused photo if nothing is selected. In the
loupe, the series compare and the series viewer they act on the photo you see (the outlined one
in the series compare). Press `Ctrl+/` at any time to see this list in the app.

## Flag, rate and label

| Keys | What it does |
|---|---|
| `P` | **Pick** the photo. Press it again to unflag. |
| `X` | **Reject** the photo. Press it again to unflag. |
| `U` | **Unflag** the photo. |
| `Shift+P`, `Shift+X`, `Shift+U` | The same, then go to the next photo. |
| `Caps Lock` | Auto-advance: with it on, every flag or rating goes to the next photo. |
| `` ` `` (backtick) | Toggle **Picked**. |
| `0`–`5` | Set the rating. `0` clears it. |
| `Shift+0`–`Shift+5` | Set the rating, then go to the next photo. |
| `[` and `]` | One star down, one star up. |
| `6` `7` `8` `9` | Colour label red, yellow, green, blue. Press again to remove it. |
| `R` | Toggle **Keep RAW** on a pair. |
| `T` | Open the tag entry for the photo or the selection: type to find a tag, `Tab` or the arrows to go through the matches, `Enter` to add, `Backspace` in the empty field to remove the last tag, `Esc` to close. |

The flag buttons run **Pick** (`P`), **Unflag** (`U`), **Reject** (`X`) from left to right on
every screen; each button's tooltip names its key.

## Move around and look

| Keys | What it does |
|---|---|
| `←` `→` `↑` `↓` | Grid and series compare: move the focus, `↑` `↓` by a row. Loupe and series viewer: switch to the previous or next photo. |
| `Home` and `End` | Go to the first or last photo. |
| `Enter` | Open the focused photo in the loupe. In the series compare: view the active photo full screen. |
| `G` | Back to the grid. |
| `E` | Open the loupe. |
| `N` | Open the series compare. |
| `Space` | Loupe: switch between fit and 100 %. |
| `Z` | Loupe and series viewer: switch between fit and 100 %. |
| `Ctrl+=` and `Ctrl+-` | Zoom in and out. |
| `F` | Fullscreen. |
| `Tab` | Show or hide the header; in the loupe, the controls. |
| `I` | Loupe: show or hide the info panel. |
| `Esc` | Close the loupe, dialog or selection mode. |
| `B` | Show or hide the flag buttons in the loupe and the series viewer. The keys and swipes keep working. |

## Filter and select

| Keys | What it does |
|---|---|
| `\` (backslash) | Show or hide the filter bar. |
| `Ctrl+L` | Switch the filters off, and on again. |
| `Ctrl+A` | Select all photos that match the filter. |
| `Ctrl+D` | Select none. |
| `Shift` + click | Select a range. |

## Series

Photos of one camera taken within a few seconds of each other, or up to 30 seconds apart while
they look alike, form a series. A series ends a minute after its first photo; a later photo starts
the next one. The series compare (`N`) shows a series as a grid that fills the screen; where a
long series does not fit, it scrolls down. In the series compare and the series viewer the flag,
rating and label keys act on the active photo (in the compare the one with the honey frame) and
the arrow keys switch it, as in Lightroom's Survey view: in the compare `←` `→` go in reading
order and `↑` `↓` to the photo above or below. The bottom bar's *Pick this, reject the rest*
acts on the active photo.

In the series compare a tap or click on a photo makes it the active one. To look at a photo
closely, press the *View full screen* button (⤢) in its top right corner, double-tap or
double-click it, or press `Enter` for the active photo: the series viewer shows it full screen,
where you zoom with `Z`, page through the series with `←` `→` and decide. *Back to the series* or
`Esc` returns to the compare with that photo active.

| Keys | What it does |
|---|---|
| `Shift+K` | **Pick this, reject the rest** of the series, as one undo step. |
| `Enter` | Series compare: view the active photo full screen. |
| `Esc` | Series viewer: back to the series. Series compare: close it. |

## Undo, delete and more

| Keys | What it does |
|---|---|
| `Ctrl+Z` | Undo. |
| `Ctrl+Shift+Z` | Redo. |
| `Delete` | Show the delete summary for the selection, else the focused photo; in the loupe, for the photo shown. |
| `Ctrl+Backspace` | Review the rejected photos before deleting them; closes the loupe first. |
| `M` | Move the selection, else the focused photo, to another folder; in the loupe, the photo shown. In that dialog, `1`–`9` choose a favourite or recent folder and `Enter` moves. |
| `Ctrl+/` | Show the shortcut help. `?` does the same. |

Deleted photos always go to the Nextcloud trash bin, where you can restore them.

## Vi keys

Turn on *Settings › Keyboard › Vi keys* to move around as in vi. They are off by default,
because `g` then starts `g g` instead of opening the grid; with them on, `Esc` leads back to
the grid. Like every [setting](settings.md), it follows you to every device.

| Keys | What it does |
|---|---|
| `h` and `l` | Previous and next photo; in the grid, move the focus left and right. |
| `j` and `k` | Grid and series compare: one row down and up. Elsewhere: next and previous photo. |
| `g g` | Go to the first photo. |
| `Shift+G` | Go to the last photo. |
| `/` | Open the filter bar. |

The other vi keys keep their honeycomb meaning: `x` rejects, `u` unflags, `p` picks and the
digits set the rating. Undo is `Ctrl+Z`.

## Where honeycomb differs from Lightroom

- `` ` `` toggles **Picked**; Lightroom cycles through pick, reject and unflagged.
- `Space` switches between fit and 100 % in the loupe; Lightroom uses it to leave the grid.
- `Tab` shows or hides the header, not Lightroom's side panels.
- `N` opens the series compare; in Lightroom it opens Survey.
- `M`, `Shift+K`, `B` and `R` exist only in honeycomb; in Lightroom `R` is Crop, which honeycomb
  does not have.
- `T` opens the tag entry; Lightroom's `T` shows or hides the toolbar.
