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

## Move around and look

| Keys | What it does |
|---|---|
| `←` `→` `↑` `↓` | Grid: move the focus. Loupe, series compare and series viewer: switch to the previous or next photo. |
| `Home` and `End` | Go to the first or last photo. |
| `Enter` | Open the focused photo in the loupe. |
| `G` | Back to the grid. |
| `E` | Open the loupe. |
| `N` | Compare the next series. *Coming in a later version.* |
| `Space` | Loupe: switch between fit and 100 %. |
| `Z` | Loupe and series viewer: switch between fit and 100 %. |
| `Ctrl+=` and `Ctrl+-` | Zoom in and out. |
| `F` | Fullscreen. |
| `Tab` | Show or hide the header; in the loupe, the controls. |
| `I` | Cycle the info overlay. |
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

Photos taken within a few seconds of each other form a series. In the series compare and the
series viewer the flag, rating and label keys act on the active photo and the arrow keys switch
it, as in Lightroom's Survey view.

| Keys | What it does |
|---|---|
| `Shift+K` | **Pick this, reject the rest** of the series, as one undo step. *Coming in a later version.* |

## Undo, delete and more

| Keys | What it does |
|---|---|
| `Ctrl+Z` | Undo. |
| `Ctrl+Shift+Z` | Redo. |
| `Delete` | Show the delete summary for the selection or focused photo. *Coming in a later version.* |
| `Ctrl+Backspace` | Review the rejected photos before deleting them. *Coming in a later version.* |
| `M` | Move the photos to another folder. In that dialog, `1`–`9` choose a favourite or recent folder. *Coming in a later version.* |
| `Ctrl+/` | Show the shortcut help. `?` does the same. |

Deleted photos always go to the Nextcloud trash bin, where you can restore them.

## Vi keys

Turn on *Settings › Keyboard › Vi keys* to move around as in vi. They are off by default,
because `g` then starts `g g` instead of opening the grid; with them on, `Esc` leads back to
the grid. Until that setting arrives, set the browser storage key `honeycomb.viKeys` to `true`.

| Keys | What it does |
|---|---|
| `h` and `l` | Previous and next photo; in the grid, move the focus left and right. |
| `j` and `k` | Grid: one row down and up. Elsewhere: next and previous photo. |
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
