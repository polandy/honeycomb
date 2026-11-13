# GRID-002 – Filters, flag filter, progress and sort

- Status: implemented
- Area: grid
- Origin: `docs/plan.md` M2.5, Culling workflow items 6–7, Grid, filters and sort,
  Sort order; Q8, Q9, Q18
- Depends on: GRID-001, DECISIONS-001

## Purpose

The flag filter and the filter bar narrow the grid to the pictures a pass is about; the progress shows
how far the cull is; the sort orders the pictures by file name or capture time.

## Behaviour

- **Flag filter:** three toggle chips in the toolbar, *Picked*, *Unflagged* and *Rejected*, each
  with its flag icon, behind a filter icon. They combine; none pressed shows every picture.
  *Picked* and *Unflagged* are pressed by default. The chips are the *Flag* group of the filter
  bar, one state shown twice.
- **Filter bar:** collapsible, toggled from the toolbar, which counts the active filter groups.
  Groups: rating (*Any*, 0–5 and a comparison button cycling *at least → at most → exactly*),
  colour label (nine swatches), flag, pairing (*Pairs*, *JPEG only*, *RAW only*), *Keep RAW*
  (*Marked*, *Not marked*), tags ([TAGS-004](../tags/TAGS-004-tag-filter-and-tile.md): a picture
  needs every chosen tag) and, for a cull of several folders, folder. OR within a group, AND
  across groups. *Clear filters* resets every group, the flag filter to its default.
- **Progress:** "x of y decided" as text and as a bar, over the pictures the filters let through.
- **Sort:** *File name* or *Capture time* in the ⋯ menu. One folder starts by file name, several
  by capture time. A picture without a capture time sorts by modification time; ties by file
  name, compared numerically on the user's locale. Opening a folder set resets filters and sort.
- **Empty view:** "No photos left to cull" (only the default flag filter) offers *Show all*; no
  match offers *Clear filters*; empty folders say so.

## Acceptance criteria

### GRID-002.1 – Flag filter default

- **Given** pictures picked, rejected and unflagged
- **When** a cull opens
- **Then** *Picked* and *Unflagged* are pressed and the grid shows all but the rejected

### GRID-002.2 – Flag chips combine

- **Given** the flag filter
- **When** the user presses any combination of *Picked*, *Unflagged* and *Rejected*, or none
- **Then** the grid shows the pictures with one of the pressed flags, or every picture when none is
  pressed, and the *Flag* group of the filter bar shows the same chips

### GRID-002.3 – Rating filter

- **Given** the rating group
- **When** the user picks N stars and cycles the comparison
- **Then** pictures with at least, at most or exactly N stars pass; *Any* is selected while no
  rating is chosen, disables the comparison, and *Any* or the pressed star chip turns the filter
  off

### GRID-002.4 – Chip groups

- **Given** the colour label, flag, pairing, *Keep RAW* and folder groups
- **When** the user switches chips in one group
- **Then** a picture passes when it matches any chosen chip of that group; a cull of one folder
  has no folder group

### GRID-002.5 – Groups combine

- **Given** filters in several groups
- **When** the grid filters
- **Then** a picture passes only when it matches every active group, and the bar says so and how
  many photos pass

### GRID-002.6 – Clear filters and the count

- **Given** active filters
- **When** the user clears them
- **Then** every group resets, the flag filter to its default; the toolbar counts each group that
  has a choice, each chosen tag as one, the flag filter when it differs from its default, and
  *Clear filters* is disabled while none is active

### GRID-002.7 – Progress

- **Given** a cull
- **When** the toolbar renders
- **Then** it shows "x of y decided" over the pictures that pass the filters (y is the number of
  pictures the grid shows) as text and a bar, empty when none shows; the progress saved with a
  recent folder set still counts every picture

### GRID-002.8 – Default sort and the sort menu

- **Given** a folder set
- **When** it opens
- **Then** one folder sorts by file name and several by capture time, and the ⋯ menu switches the
  order

### GRID-002.9 – Capture time and ties

- **Given** pictures with and without a capture time
- **When** they sort by capture time
- **Then** the RAW member's capture time counts, else the rendered member's, else the
  modification time, and ties go by file name in numeric order (`IMG_2` before `IMG_10`)

### GRID-002.10 – A new folder set starts unfiltered

- **Given** active filters and a chosen sort
- **When** the user opens another folder set
- **Then** the filters and the sort reset to their defaults

### GRID-002.11 – Empty views

- **Given** a view that shows nothing
- **When** the folders hold no photos, the default flag filter leaves nothing, or no picture matches
- **Then** the grid says which, offers *Show all* (no flag pressed) for the flag filter and
  *Clear filters* for filters

### GRID-002.12 – One icon per flag

- **Given** the flags *picked*, *rejected* and *unflagged*
- **When** the action bar, the flag filter or a thumbnail shows them
- **Then** each uses the same icon everywhere: a filled flag, a flag with an X and an outline flag;
  each button keeps its label

## Out of scope

The filter toggle key (KEYS-001), the decisions themselves (DECISIONS-001).

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written from the merged M2.5 (#43) |
| 2026-11-11 | The scope control becomes a combinable flag filter (owner) |
