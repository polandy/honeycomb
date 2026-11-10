# 0020 – The navigation is closed through @nextcloud/event-bus

- Status: accepted
- Date: 2026-11-10

## Context

On a narrow screen the app navigation lies over the photos, so the mockup closes it after a tap
on a recent folder set, *Folder* or *Settings* (DECISIONS-002.12). `NcAppNavigation` of
`@nextcloud/vue` 9 keeps its open state to itself: it has no `open` prop or exposed method, and it
closes only on Escape, a tap outside, its own toggle, or the `toggle-navigation` event of
`@nextcloud/event-bus`. `NcAppNavigationItem` sends that event itself, but only for router links,
and honeycomb has no router.

The options:

- **Emit `toggle-navigation` with `@nextcloud/event-bus`:** the way `@nextcloud/vue` closes the
  navigation itself. The package is already in the bundle through `@nextcloud/vue` and
  `@nextcloud/auth`; using it means declaring it as a direct dependency.
- **A router with `to` links:** a whole routing layer for one side effect, and the app has no URLs
  to route.
- **Our own navigation instead of `NcAppNavigation`:** loses the shared component, its toggle,
  focus trap and styling (CLAUDE.md, Vue).

## Decision

honeycomb declares **`@nextcloud/event-bus`**, pinned to the exact version `@nextcloud/vue`
already resolves, and uses it only in `src/components/AppNavigation.vue` to emit
`toggle-navigation` with `{ open: false }` after a tap, when `useIsMobile()` of `@nextcloud/vue`
reports a narrow screen — the same breakpoint (1024 px) at which `NcAppNavigation` lays itself
over the content.

## Consequences

- No code is added to the bundle; the lock file only marks the package as direct.
- Dependabot updates it like every npm package; it must stay on the major version
  `@nextcloud/vue` uses, or the two would hold separate buses and the event would not arrive.
- The breakpoint is Nextcloud's 1024 px, not the mockup's 1000 px.
