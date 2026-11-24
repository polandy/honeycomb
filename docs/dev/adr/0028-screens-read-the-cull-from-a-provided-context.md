# 0028 – Screens read the cull from a provided context

- Status: accepted
- Date: 2026-11-15

## Context

`App.vue` wires about seventeen composables and passed their state to each screen as props: the
grid toolbar took 22 props and 16 events, the loupe 17 props, the grid 14. Every new menu entry
(the series menus of #185) had to go through App's template, the screen and the toolbar. App was
at 295 of 300 lines and the file changed most often (architecture review, finding B5).

The options:

- **Keep drilling props:** no new pattern, but App stays the bottleneck and the toolbar's props
  keep growing one by one.
- **A store (Pinia):** a new dependency and a second way to hold state beside the composables,
  which the seam tests build directly.
- **A typed context through `provide`/`inject`:** App provides what the screens share once; a
  screen's root component reads it. Vue built-in, no dependency.

## Decision

App provides one **`CullContext`** (`src/cull-context.ts`) with `provideCullContext`; a screen's
root component reads it with `useCullContext`, which throws when no parent provides it. The
injection key stays private to the module.

- Only **screen roots** inject (`GridScreen`, `LoupeScreen` and `SeriesCompareScreen`).
  The components below a root keep plain props and events, so they stay testable on their own.
- The context holds the cull and the selection whole, and of each flow only the members a screen
  uses (`Pick<…>`), so a test fakes a flow in a line. A screen that needs more widens the `Pick`;
  the series compare, whose screen binds nearly all of it, is held whole and faked by a real flow.
- A leaf with many props takes them in **groups** of one concern each: the toolbar takes
  `folders`, `view`, `progress`, `selection` and `tasks` (`src/grid-toolbar.ts`).
- Tests mount a screen with `mountInCullContext` over `fakeCullContext`
  (`tests/js/cull-context-fake.ts`): a real cull and selection, the flows recorded.

## Wiring rule

Two ways to hand state down, each for one case:

- **Screens** take what they share through `provide`/`inject` (the `CullContext`).
- **Flows** (`*-flow.ts`, one user task such as delete or move) take their dependencies as
  parameters, a context object the caller builds; a flow never injects.

## Consequences

- App renders `<GridScreen>` instead of the grid's six components and their 60 bindings; it
  reaches the grid and the filter bar through the screen's exposed refs for its hotkeys.
- A screen's dependencies are no longer visible in App's template; they are listed in the
  `CullContext` type instead.
- App renders `<LoupeScreen>` instead of the loupe's ten props and ten events; the screen binds them
  from the context, and `PhotoLoupe` keeps its props, so its own tests mount it unchanged (R8 b).
- App renders `<SeriesCompareScreen>` (formerly `SeriesCompareFlow`) without props; the screen
  binds the compare and its viewer from the context, and both keep their props (R8 c).
