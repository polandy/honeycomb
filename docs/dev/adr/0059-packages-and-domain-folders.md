# 0059 – Packages in lib/ and domain folders in src/

- Status: accepted
- Date: 2026-11-24

## Context

`lib/Service` held some 130 classes in one namespace, and `Db` and `Immich` used its values
directly, so a change to a service's value reached the mappers. `src/` held about 120 glue
modules side by side with `App.vue`. Nothing said which part may use which, so every file
could reach every other one, and `App.vue` grew to the 300-line limit.

## Decision

- **Domain.** `lib/Domain` holds the values and enums more than one package uses (flags,
  limits, request reasons, the photo file kinds) and, in `Domain/Store`, the store interfaces
  the services read and `Db` implements. It uses no other package. `Db` and `Immich` use no service:
  only `Domain` and the few packages `PackageDependencyTest` lists for them.
- **Service packages.** `lib/Service` is cut into one package per function: `App`, `Decision`,
  `Files`, `Folder`, `Hash`, `Image`, `Lifecycle`, `Listing`, `Move`, `Quality`, `Series`,
  `Settings`, `Sidecar`, `Stats`, `Support`, `Trash`, `Xmp`. No class stays in the bare
  `Service` namespace.
- **The rule.** `tests/php/Conventions/PackageDependencyTest.php` lists the packages each
  package may use and fails on any other reference, in a `use` line or fully qualified in code.
  A package without an entry (`AppInfo`, `BackgroundJob`, `Command`, `Controller`, `Listener`,
  `Migration`, `Preview`) wires the others and may use every one.
- **Frontend folders.** Beside the layers `logic/` (pure, ADR 0006), `components/` and `api/`,
  `src/` has `app/` (the shell), `shared/` (browser helpers without a domain) and one folder
  per domain: `cull`, `folders`, `grid`, `hashes`, `immich`, `loupe`, `move`, `series`,
  `settings`, `sidecars`, `statistics`, `trash`. `FOLDER_IMPORTS` in `eslint.config.mjs` lists
  which folders each may import; `no-restricted-imports` fails on the others. `app/` and
  `components/` may import every folder.
- **The shell by area.** `App.vue` keeps the cull wiring; the source opening (`app-source.ts`),
  the dialogs (`app-dialogs.ts`) and the seams per area (`app-seams-*.ts`) leave it.
- **Size warning.** `scripts/source-sizes.sh` warns from 251 lines, before the 300-line limit
  fails, so a file is cut while it still has one clear seam.

## Options considered

- **Psalm or deptrac for the PHP rule**: psalm has no layer rule without a plugin, and deptrac
  is a new dependency; a PHPUnit test over the sources needs neither.
- **`eslint-plugin-import` or `eslint-plugin-boundaries` for the frontend rule**: a new
  dependency for what one `no-restricted-imports` pattern per folder already says.
- **Move the tests into folders too**: `tests/js` stays flat; its names already carry the
  module, and moving 350 files buys no rule.

## Consequences

- A new class or module names its package or folder; a new dependency between two of them is a
  line in `PackageDependencyTest` or `FOLDER_IMPORTS`, visible in review.
- Paths in older ADRs and specs name the old flat files where they were written; the code is
  the current list.
