# 0042 – An axe-core accessibility scan in the e2e run

- Status: accepted
- Date: 2026-11-19

## Context

The contrast faults of the UX review (H1, H2) came with the colour variables of Nextcloud 35 and
can come back with every Nextcloud update. The 44 px check (GRID-001.19) proves touch targets,
not contrast, names or roles. Nothing checks those in the real app, light or dark (review UX-5).

The options:

- **`@axe-core/playwright`:** Deque's Playwright binding of axe-core, the de facto rule engine for
  WCAG checks (MPL-2.0). It runs in the e2e browser against the real Nextcloud, so it sees the
  server's theme variables. One dev dependency and axe-core under it; nothing ships in the app.
- **Own checks in `tests/e2e/`:** contrast maths and name rules written here. No dependency, but
  a second, weaker rule engine to keep.
- **Lighthouse or pa11y in CI:** a page per run without our Playwright steps, so it cannot open
  the loupe, a dialog or the series viewer.

## Decision

- `@axe-core/playwright` and `axe-core` are exact dev dependencies; `tests/e2e/a11y.ts` wraps
  them, `tests/e2e/a11y.spec.ts` opens every screen of APP-001.15, one test per screen, in the light and the dark theme.
- The scan runs the WCAG 2.0, 2.1 and 2.2 A and AA rules; a fault rated *moderate*, *serious* or
  *critical* fails the test (*moderate* joined on 2026-11-24, after the screens passed it). *Minor*
  faults are not gated: axe-core rates them as best practice. The same scan fails any visible
  text under 12 px, which axe-core does not check.
- A known fault is excluded by its rule and element in one list in `tests/e2e/a11y.ts`, each with
  a `TODO.md` item, as the touch target check does.

## Consequences

- A theme or component update that drops contrast below 4.5:1, or a control without a name,
  turns CI red with the rule, the element and the screen.
- axe-core cannot judge everything (focus order, meaning of a name, screen reader output); a
  manual check stays part of the UX reviews.
- Dropping the scan is deleting two test files and the two dependencies.
