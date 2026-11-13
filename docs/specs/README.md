# Specifications

The binding description of honeycomb's observable behaviour, one feature per file (ADR 0015).
`docs/plan.md`, the mockup and the ADRs say what we plan and why; a spec says exactly what the
merged code does. Spec, tests and code change in the same pull request.

## Index

| Area | Specs |
|---|---|
| `app/` | [APP-001](app/APP-001-app-page.md) app page and navigation, [APP-002](app/APP-002-tooltip.md) tooltip |
| `listing/` | [LISTING-001](listing/LISTING-001-entries.md) entries of a folder set, [LISTING-002](listing/LISTING-002-pairing.md) pairing, [LISTING-003](listing/LISTING-003-folder-picker.md) folder picker |
| `images/` | [IMAGES-001](images/IMAGES-001-preview-tiers.md) preview tiers and background previews |
| `grid/` | [GRID-001](grid/GRID-001-grid.md) grid, [GRID-002](grid/GRID-002-filters-and-sort.md) flag filter, filters, progress and sort, [GRID-003](grid/GRID-003-selection.md) selection mode |
| `decisions/` | [DECISIONS-001](decisions/DECISIONS-001-decision-storage.md) decision storage, [DECISIONS-002](decisions/DECISIONS-002-resume-position.md) resume position |
| `loupe/` | [LOUPE-001](loupe/LOUPE-001-loupe.md) loupe, [LOUPE-002](loupe/LOUPE-002-decisions-in-the-loupe.md) decisions in the loupe, [LOUPE-003](loupe/LOUPE-003-view-state.md) view state |
| `move/` | [MOVE-001](move/MOVE-001-name-templates.md) name templates, [MOVE-002](move/MOVE-002-move-endpoints.md) move endpoints, [MOVE-003](move/MOVE-003-move-plan-and-report.md) move plan, conflicts, report and undo, [MOVE-004](move/MOVE-004-move-dialog.md) move dialog and move summary |
| `keys/` | [KEYS-001](keys/KEYS-001-key-map.md) key map, undo, redo and the shortcut sheet |
| `delete/` | [DELETE-001](delete/DELETE-001-trash.md) trash endpoint, [DELETE-002](delete/DELETE-002-reject-review.md) reject review and delete, [DELETE-003](delete/DELETE-003-remove-raws.md) Remove RAWs |
| `series/` | [SERIES-001](series/SERIES-001-series-compare.md) series compare, [SERIES-002](series/SERIES-002-series-viewer.md) series viewer and series badge |
| `tags/` | [TAGS-001](tags/TAGS-001-tag-storage.md) tag storage and tag list |
| `settings/` | [SETTINGS-001](settings/SETTINGS-001-settings.md) per-user settings |
| `xmp/` | [XMP-001](xmp/XMP-001-sidecar-model-and-mapping.md) sidecar model and decision mapping, [XMP-002](xmp/XMP-002-sidecar-endpoints.md) sidecar endpoints, [XMP-003](xmp/XMP-003-sidecars-in-the-cull.md) sidecars in the cull, [XMP-004](xmp/XMP-004-tags-in-sidecars.md) tags in sidecars |

## IDs and status

- File: `docs/specs/<area>/<ID>-<short-name>.md`. ID: the area's prefix and a three-digit number,
  never reused. Criterion: `<ID>.<n>`, never renumbered.
- `draft`: not binding yet. `accepted`: binding, not yet implemented. `implemented`: the merged
  code does it and every criterion has a test. `removed`: the feature is gone; *History* says why.
- A criterion heading ends in `(removed)` when the rule was dropped; it keeps its number.
- A criterion heading ends in `(gap)` when the merged code does not do it yet, or no test proves
  it. Each gap has a `TODO.md` item that names its ID; the pull request that closes it drops the
  suffix and marks the test.

## Rules

1. Describe what a user, the API or the files can observe; not how the code does it.
2. Every criterion is checkable, written as Given / When / Then. Error and edge cases are their
   own criteria.
3. Use the glossary's words (`docs/04-glossary.md`).
4. A test that proves a criterion carries a marker line right above it: `// spec: GRID-001.3`
   (several IDs comma-separated). One test may prove several criteria.
5. A pull request that changes behaviour under `lib/`, `src/`, `appinfo/`, `templates/` or `css/`
   changes the spec too, or says `Spec-Unchanged: <reason>` on a line of its description (a
   refactor, a fix that makes the code do what the spec already says). A pull request that changes
   an `implemented` spec changes code or tests too, or says `Spec-Only: <reason>` (rewording).

## Checks

- `scripts/specs.sh`: required fields, unique IDs and criteria, every marker names a criterion of
  an `accepted` or `implemented` spec, every open criterion of an `implemented` spec has a test,
  every gap has its `TODO.md` item.
- `scripts/spec-trailers.sh`: rule 5, on the pull request's changed files and its description
  (the squash commit). The `Pull request message` workflow runs it and reruns it when the
  description is edited; `scripts/verify.sh` runs it against `origin/main` with the branch's
  commit messages.
- `/pr-review` reads the diff against the spec: a trailer only passes the check, the reviewer
  judges whether the reason is true.

## Template

```markdown
# <ID> – <Title>

- Status: draft | accepted | implemented | removed
- Area: <area>
- Origin: <plan.md section, ADR, requirement or mockup screen>
- Depends on: <spec IDs, or –>

## Purpose

<One to three sentences: what the feature is for.>

## Behaviour

<Prose, tables where they help.>

## Acceptance criteria

### <ID>.1 – <short title>

- **Given** …
- **When** …
- **Then** …

## Out of scope

<What belongs elsewhere, and where.>

## History

| Date | Change |
|---|---|
```
