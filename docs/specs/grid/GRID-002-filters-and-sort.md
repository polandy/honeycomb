# GRID-002 – Filters, scope, progress and sort

- Status: implemented
- Area: grid
- Origin: `docs/plan.md` M2.5, Culling workflow items 6–7, Grid, filters and sort,
  Sort order; Q8, Q9, Q18
- Depends on: GRID-001, DECISIONS-001

## Purpose

The scope and the filter bar narrow the grid to the pictures a pass is about; the progress shows
how far the cull is; the sort orders the pictures by file name or capture time.

## Behaviour

- **Scope:** *not rejected* (default), *undecided* (unflagged only) or *all*. A flag filter
  overrides it; the scope control is then disabled and says why.
- **Filter bar:** collapsible, toggled from the toolbar, which counts the active filter groups.
  Groups: rating (*Any*, 0–5 and a comparison button cycling *at least → at most → exactly*),
  colour label (nine swatches), flag, pairing (*Pairs*, *JPEG only*, *RAW only*), *Keep RAW*
  (*Marked*, *Not marked*) and, for a cull of several folders, folder. OR within a group, AND
  across groups. *Clear filters* resets every group and keeps the scope.
- **Progress:** "x of y decided" as text and as a bar, over every picture of the cull.
- **Sort:** *File name* or *Capture time* in the ⋯ menu. One folder starts by file name, several
  by capture time. A picture without a capture time sorts by modification time; ties by file
  name, compared numerically on the user's locale. Opening a folder set resets filters and sort.
- **Empty view:** "No photos left to cull" (scope *not rejected*) and "Every photo is decided"
  (scope *undecided*) offer *Show all*; no match offers *Clear filters*; empty folders say so.

## Acceptance criteria

### GRID-002.1 – Scope

- **Given** pictures picked, rejected and unflagged
- **When** the scope is *not rejected*, *undecided* or *all*
- **Then** the grid shows all but the rejected, only the unflagged, or every picture

### GRID-002.2 – A flag filter overrides the scope

- **Given** the scope *not rejected*
- **When** the user filters for *Rejected*
- **Then** the rejected pictures show, and the scope control is disabled and says why

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
- **Then** every group resets and the scope stays; the toolbar counts each active group once and
  *Clear filters* is disabled while none is active

### GRID-002.7 – Progress

- **Given** a cull
- **When** the toolbar renders
- **Then** it shows "x of y decided" over every picture as text and a bar, empty for a cull
  without photos

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
- **When** the folders hold no photos, the scope leaves nothing, or no picture matches
- **Then** the grid says which, offers *Show all* for the scope and *Clear filters* (keeping the
  scope) for filters

## Out of scope

The filter toggle key (KEYS-001), the decisions themselves (DECISIONS-001).

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written from the merged M2.5 (#43) |
