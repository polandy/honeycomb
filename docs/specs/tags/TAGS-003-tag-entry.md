# TAGS-003 – Tag entry

- Status: implemented
- Area: tags
- Origin: `docs/07-tags.md` Interaction (Tag entry, D8), outline step 4; `docs/mockup/index.html`
- Depends on: TAGS-002, KEYS-001, GRID-003, LOUPE-001, SERIES-002

## Purpose

Adds and removes tags on the photo in view or on the grid's selection, from the keyboard (`T`)
or by touch (*Tags* in the action bar), with autocomplete over the user's tag list.

## Behaviour

**Opening.** `T` opens the tag entry for the loupe's photo, the series viewer's photo or, in the
grid, the selection in selection mode and else the focused photo. The *Tags* button of the action
bar opens it the same way; it is off while nothing is selected. The field has the focus, and the
app's other keys do nothing while the entry is open.

**Chips.** The targets' tags are chips, sorted; a tag only some targets have is a partial chip,
dashed, with its count (`2/7`). A chip's × removes the tag from every target, as `Backspace` in
an empty field does for the last chip.

**Autocomplete.** The known tags are the tag list, the tags of the cull and every level of each
(`Places/Italy` brings `Places`). Those that contain the field's text, ignoring case, are offered,
sorted, except tags every target already has; when the field names a tag not known, *Create tag
"…"* is offered after them. `Tab` and `↓` put the next match into the field, `Shift+Tab` and `↑`
the one before, wrapping around. A tap on a match assigns it.

**Assigning.** `Enter` assigns exactly the field, each name trimmed; a known tag that differs only
in case is taken as known. `/` separates levels: `Places/Italy/Bolzano` tags only that path, and
its levels are known from then on. A field with an empty name or a `|` assigns nothing and the
entry says why. The field empties and the entry stays open.

**Undo and toast.** Each assignment or removal is one undo step over the pictures it altered and
one toast with *Undo*: "Tagged DSC_4103 Sunrise", "Tagged 7 photos Dolomites", "Removed Anna from
2 photos". A change that alters no picture records and says nothing. Undo takes the tag off, or
puts it back on, exactly those pictures; redo repeats the change. A failed save, also of an undo
or a redo, puts the tags back and the grid says the change could not be saved, as for a decision.

**Closing.** `Esc` or *Done* closes the entry; the next `Esc` closes the loupe. On a narrow screen
the entry is a bottom sheet.

**Tag list.** The tag list is read when a cull opens. A failed read is logged and the known tags
are the cull's own.

## Acceptance criteria

### TAGS-003.1 – `T` opens the entry for what is in view

- **Given** the grid in selection mode with two photos selected, the grid with a focused photo,
  the loupe and the series viewer
- **When** the user presses `T`
- **Then** the tag entry opens for the selection, the focused photo, the loupe's photo and the
  viewer's photo, with the field focused

### TAGS-003.2 – *Tags* in the action bar

- **Given** the action bar of the selection, the loupe or the series viewer
- **When** the user taps *Tags*
- **Then** the tag entry opens for the same targets as `T`; with nothing selected the button is
  off

### TAGS-003.3 – Chips and partial chips

- **Given** three targets of which all have `Sunrise` and one has `People/Anna`
- **When** the entry opens
- **Then** it shows the chip `People/Anna` dashed with `1/3` and the chip `Sunrise` plain

### TAGS-003.4 – Autocomplete by substring

- **Given** the tag list `Natur/Berg`, `Bergsee`, `People/Anna` and a target that has `Bergsee`
- **When** the user types `BERG`
- **Then** the entry offers `Natur/Berg` and then *Create tag "BERG"*, but not `Bergsee`, which
  every target has

### TAGS-003.5 – Levels are known, a new tag is offered to create

- **Given** the tag list `Places/Italy/Dolomites`
- **When** the user types `places/ital` and then `Places/Spain`
- **Then** the entry offers `Places/Italy` and `Places/Italy/Dolomites`, and then *Create tag
  "Places/Spain"*

### TAGS-003.6 – Cycling the matches

- **Given** three matches
- **When** the user presses `Tab` four times, then `Shift+Tab`, `↓` and `↑`
- **Then** the field holds the first, second, third and first match, then the third, the first and
  the third

### TAGS-003.7 – `Enter` assigns the field and keeps the entry open

- **Given** the tag list `Places/Italy`
- **When** the user types ` places / italy ` and presses `Enter`, then `Places/Italy/Bolzano` and
  `Enter`
- **Then** the targets get `Places/Italy`, then `Places/Italy/Bolzano`; the field is empty after
  each and the entry stays open

### TAGS-003.8 – A tag that is not valid is refused

- **Given** the field `Places//Rome` or `A|B`
- **When** the user presses `Enter`
- **Then** nothing is assigned or stored and the entry says that a tag needs names without `|`;
  `Enter` in an empty field does nothing

### TAGS-003.9 – Removing a tag

- **Given** targets with the chips `People/Anna` and `Sunrise`
- **When** the user taps × on `People/Anna`, then presses `Backspace` in the empty field
- **Then** `People/Anna` and then `Sunrise` are removed from every target

### TAGS-003.10 – One undo step and one toast per change

- **Given** seven photos of which two have `Dolomites`
- **When** the user tags them `Dolomites`, then undoes and redoes
- **Then** the toast says "Tagged 5 photos Dolomites" with *Undo*, the undo removes it from those
  five only and says "Undid: Tagged 5 photos Dolomites", and the redo tags them again

### TAGS-003.11 – A change that alters nothing

- **Given** a photo without `Sunrise`
- **When** the user removes `Sunrise` from it through a change
- **Then** no undo step is recorded, nothing is stored and no toast appears

### TAGS-003.12 – Closing the entry

- **Given** the tag entry open in the loupe
- **When** the user presses `Esc`, then `Esc` again, or taps *Done*
- **Then** the first `Esc` closes the entry only and the second the loupe; *Done* closes the entry

### TAGS-003.13 – The tag list

- **Given** a tag list on the server, and then a tag list read that fails
- **When** the cull opens
- **Then** the known tags are the tag list and the cull's tags with their levels; after the failure
  the error is logged and the known tags are the cull's own

### TAGS-003.14 – A failed save is said

- **Given** a tagged photo whose tag save then fails
- **When** the user undoes the tag, and later tags it again with the save working
- **Then** the photo keeps its tag, the grid says the change could not be saved, and the next save
  clears the notice

## Out of scope

The tag filter, the tile's tag icon and the info panel's tags
([TAGS-004](TAGS-004-tag-filter-and-tile.md)); renaming or deleting tags across pictures (D7).

## History

| Date | Change |
|---|---|
| 2026-11-13 | Written with the tag entry (*Tags 2*) |
