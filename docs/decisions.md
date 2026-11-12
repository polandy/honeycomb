# Decisions

Smaller decisions made during implementation, one dated line each; larger ones become an
[ADR](adr/).

## Owner review 2026-11-10

The owner reviewed the autonomous decisions of 2026-11-10 below and confirmed all of them, except
these changes; a changed line below is marked *(changed by the owner review)*.

- 2026-11-10: XMP sidecars are written as soon as any attribute is set on a photo (flag, rating,
  colour label, *Keep RAW*), a member without one gets a new `<file>.xmp`, and a photo no step
  touched gets none (XMP-003.15). The shared-folder rule Q20 stays.
- 2026-11-10: Public links, mail shares and external storage mounted for several users make a
  folder shared too (ADR 0017 amendment); external storage counts once Nextcloud's mount cache
  lists another user for it.
- 2026-11-10: The info panel's open state and whether the gesture guide was seen are kept per user
  on the server (ADR 0019); a value in the browser's local storage is moved there once.
- 2026-11-10: Listing Canon `.CR3` files is a low-priority `TODO.md` item.

## Decisions

- 2026-11-10: CI skips a job whose paths a pull request does not touch. `scripts/ci-changes.sh`
  maps the changed files (GitHub API, no deep checkout) to the groups `markdown`, `php`, `ts` and
  `app`; an unknown path or a push to `main` turns everything on, so a skip is never a guess.
- 2026-11-10: The single required check is `CI gate`. It always runs and fails only when a job
  failed or was cancelled, so a skipped job counts as passed and the merge gate keeps every check.
  Each new CI job (PHP, TypeScript, build, e2e) joins the gate's `needs` and takes its group's
  `if:` from `changes`.
- 2026-11-10: REUSE lint always runs, because any new file can lack a header; it takes seconds.
- 2026-11-10: Superseded runs of the same pull request are cancelled (`concurrency` in `ci.yml`,
  never on `main`).
- 2026-11-10: One setup per toolchain instead of one per tool: a `PHP` job per version runs
  php-cs-fixer (8.3 only, formatting does not depend on the version), psalm and PHPUnit after a
  single `composer install`, and one `TypeScript` job runs eslint, tsc and Vitest after a single
  `npm ci`. Ten jobs become five, and a failing step still names the tool.
- 2026-11-10: Composer's download cache is kept with `actions/cache` keyed on `composer.lock`; npm
  uses `setup-node`'s `cache: npm`. The first run after a lock change refills them.
- 2026-11-10: Build and e2e (M2.1) take the `app` group and join the gate's `needs`.
- 2026-11-10: Conventions from Stella, JIT-Pack and glissando are consolidated in
  `conventions.md` (every language) beside `03-coding-standards.md` (stack idioms), so neither
  repeats the other.
- 2026-11-10: Source files have at most 300 lines (glissando) rather than 800 with a ratchet
  (JIT-Pack) or no limit (Stella). One script covers PHP, TypeScript, Vue and shell alike,
  which ESLint's `max-lines` cannot.
- 2026-11-10: No Prettier, which all three use: `@nextcloud/eslint-config` already formats
  TypeScript and Vue with its stylistic rules, and the two would fight.
- 2026-11-10: No `no-magic-numbers` lint rule (JIT-Pack rejected it for firing on one-off
  geometry); the named-constant rule is checked in review.
- 2026-11-10: Doc comments on exports are required (Stella, JIT-Pack; glissando has no rule), one
  line each; `jsdoc/require-param` is off because the types carry the parameters.
- 2026-11-10: Type-aware linting through `typescript-eslint` as a direct dev dependency, pinned to
  the version `@nextcloud/eslint-config` already pulls in; it adds `no-floating-promises` and
  `no-misused-promises` (glissando).
- 2026-11-10: `tsconfig.json` adds glissando's `noImplicitOverride` and
  `noFallthroughCasesInSwitch`, plus `noImplicitReturns`.
- 2026-11-10: Hand-written fakes in TypeScript (all three), but PHPUnit test doubles for `OCP`
  interfaces: they are Nextcloud's convention and the interfaces too wide to fake by hand.
- 2026-11-10: The coverage gate stays at 95 % lines and 90 % branches for `src/logic/`, stricter
  than JIT-Pack's 75 % and the others' none; no mutation tool, a fix is reverted once by hand.
- 2026-11-10: PHPUnit runs in random order and prints the seed; Vitest restores mocks, globals
  and env after each test instead of shuffling, so a failure stays reproducible.
- 2026-11-10: psalm checks `tests/php/` too and forbids file-system, shell, clock, randomness and
  debug-output functions, so CLAUDE.md rule 1 and the injected seams are checked, not only read.
- 2026-11-10: `scripts/pins.sh` checks exact versions, Action SHAs and image digests (glissando
  `pins.sh`); the composer image in `scripts/php.sh` is pinned by digest. `nextcloud/ocp` stays on
  `dev-stable35`, the branch Nextcloud publishes, locked by `composer.lock`.
- 2026-11-10: The convention gates run in their own always-on CI job; they need no setup and take
  seconds.
- 2026-11-10: The listing is `GET /api/v1/entries?path=…&subfolders=1` rather than a path
  segment in the URL, so the root folder and names with `#`, `?` or `%` need no special route
  (ADR 0009).
- 2026-11-10: The listing caps at 60,000 entries, not 20,000: the server does not pair, and
  20,000 pictures of a RAW, a JPEG and a sidecar each are 60,000 files. The client applies the
  20,000-picture cap after pairing.
- 2026-11-10: The subfolder search pages by file id in pages of 5,000 and reads metadata in
  batches of 1,000 ids, so memory stays flat and no `IN` list exceeds a database's limit.
- 2026-11-10: Hidden names are skipped too, not only hidden folders, so macOS `._IMG_0001.JPG`
  files never pose as pictures; a hidden folder the user picks on purpose is listed.
- 2026-11-10: EXIF basics come from the Photos app's metadata keys; without them the fields are
  `null` and the client falls back to `mtime`. Width and height come only as a pair.
- 2026-11-10: The listing's per-folder shared flag moves from M1.2 to M5, the first item that
  acts on it; detecting outgoing shares needs `OCP\Share\IManager` and its own tests.
- 2026-11-10: In *separate subfolders*, a file whose folder is named like the RAW or the rendered
  subfolder pairs in the parent folder, together with the parent's own files; its role still
  comes from its extension. Other folders keep pairing side by side.
- 2026-11-10: A sidecar belongs to the member whose file name it carries (exactly, else ignoring
  case when only one member matches), else to a darktable duplicate's member, else as shared
  `<base>.xmp` to the picture of that base name. An ambiguous base name shares no `<base>.xmp`,
  so deleting one of its singles never removes a sidecar the others still use.
- 2026-11-10: Pairing ignores files outside both extension lists, names without a base name
  (`.JPG`) and sidecars without an owner. An extension in both lists, `xmp` or an empty one in
  a list is a settings error, since a file's role would be undefined.
- 2026-11-10: The pairing vectors (`tests/fixtures/pairing/vectors.json`) mark each case with
  `sharedWithFramehive`; the others follow rules where honeycomb differs from LIBRARY-001
  (case-insensitive base names, separate subfolders, darktable duplicates).
- 2026-11-10: The frontend loads one script, `js/honeycomb-main.mjs`, added in
  `templates/main.php`; `@nextcloud/vite-config` inlines the CSS into it (`inlineCSS`), so no
  `Util::addStyle` is needed. `Util::addScript` is static and cannot run in PHPUnit, so the
  template calls it and the e2e case covers it.
- 2026-11-10: The skeleton shows the mockup's empty state *No folder chosen* / *Pick a folder to
  start culling.* in `NcEmptyContent`, until the folder picker arrives with M2.3.
- 2026-11-10: Vue errors reach `@nextcloud/logger` through `app.config.errorHandler`
  (`src/create-honeycomb-app.ts`, logger injected); `src/main.ts` and `src/logger.ts` are wiring
  only, left out of coverage and covered by the e2e case. `src/*.ts` and `src/**/*.vue` keep the
  80 % lines gate of `02-workflow.md` §2.3.
- 2026-11-10: The stub catalogue of ADR 0007 marks every string with a `[de]` prefix through a `Proxy`
  in `@nextcloud/l10n`'s registry, so it needs no list of strings. Components are
  shallow-mounted, so `@nextcloud/vue`'s own English stays out and the props of the stubs, which
  render as attributes, are checked with the attributes of `vue/no-bare-strings-in-template`.
- 2026-11-10: e2e runs one Playwright project, desktop Chromium at 1440 × 900; the reference
  device projects join with the grid (M2.3), when there is a layout to check on them. Nextcloud
  logs a page in only through the login form, not HTTP basic auth, so a setup project logs in
  once and stores the session.
- 2026-11-10: CI builds and runs Playwright in one job, `Build and e2e`, since the e2e case needs
  the bundle and a separate build job would repeat `npm ci`; it uploads the traces when it fails.
  An e2e spec and `playwright.config.ts` also run the `TypeScript` job, which lints them.
- 2026-11-10: e2e never reuses a running server and takes its port from `HONEYCOMB_E2E_PORT`,
  because a server left by another worktree would test the wrong checkout.
- 2026-11-10: Image URLs carry the tier and the mtime as query parameters
  (`/api/v1/images/{fileId}?size=…&v=…`), like the listing's (ADR 0009, ADR 0010).
- 2026-11-10: A stale `v` still gets the current image, with `Cache-Control: private, no-cache`
  instead of `404`, so a grid listed before an edit shows the picture rather than a broken tile.
- 2026-11-10: The tiers go through `OCP\IPreview` although Nextcloud rounds them up to powers of
  four (512 → up to 1024 px, 2048 → up to 4096 px): an own scaled copy would need an own cache
  and its clean-up; the budget measurement decides whether that is worth it.
- 2026-11-10: The RAW preview is the largest baseline or progressive JPEG in the file, found by
  walking JPEG marker segments; lossless JPEGs are skipped, since CR2 and DNG store sensor data
  as lossless JPEG. Only the embedded JPEG's own orientation tag is applied; the RAW's own
  orientation is not read.
- 2026-11-10: Previews are warmed when the client opens a folder set (`POST /api/v1/previews`),
  not on every upload: generating three tiers for every image of every user costs CPU and
  storage for people who never cull; the Preview Generator app covers uploads for admins who
  want it.
- 2026-11-10: A file the warm-up cannot find or render is skipped with a debug log line.
- 2026-11-10: The controller answers a matching `If-None-Match` with `304` itself before
  rendering, so a revisit never generates a preview; Nextcloud's `NotModifiedMiddleware` would
  only check after the controller ran.
- 2026-11-10: `OcpJpegDecoder` wraps `new OCP\Image()`, which needs a running Nextcloud, behind
  the `JpegDecoder` interface; PHPUnit fakes the interface and the e2e case covers the class.
- 2026-11-10: The budgets are not measured yet: no real 24 MP RAW+JPEG pairs are available to
  the agents. The measurement is a `TODO.md` item for the owner's files.
- 2026-11-10: The folder picker counts photos by listing and pairing the ticked folders in
  TypeScript (ADR 0011); the listing is cached per folder and reused when the cull opens.
- 2026-11-10: Folder paths in the client are `''` for the root and `/a/b` otherwise, as the
  listing returns them; no trailing slash.
- 2026-11-10: The grid sorts by *File name* for one folder and by *Capture time* for several;
  with *Group by folder* it orders by folder first. Names compare with `Intl.Collator`, numeric;
  the 20,000 cap keeps the earliest by capture time, ties in listing order.
- 2026-11-10: The grid warms previews for the shown member of each shown picture only, so a
  request stays below ADR 0010's 60,000 ids.
- 2026-11-10: A child folder whose own listing fails is still listed, with `hasSubfolders: false`;
  opening it then answers `403` or `404`.
- 2026-11-10: Counts in strings use `{count}` with `Intl.NumberFormat`, not `%n`, because `n()`
  inserts the raw number ("1840" instead of "1,840").
- 2026-11-10: A single's badge reads "{extension} only" ("JPG only", "HEIC only", "NEF only"), a
  pair's "JPG+CR3", rendered extension first, `jpeg` shown as `JPG`.
- 2026-11-10: The ⋯ *More* menu is an `NcPopover`, because `NcActions` cannot hold the thumbnail
  size range input.
- 2026-11-10: Icons are the mockup's inline SVG paths in `AppIcon.vue`; an icon package would be
  a new dependency and needs an ADR first.
- 2026-11-10: Pinch to resize tiles uses touch events, as in the mockup, since two-finger
  distance needs both touches at once.
- 2026-11-10: Icon-only controls carry an `aria-label` and a tooltip (APP-002); the native `title`
  stays unused.
- 2026-11-10: `.CR3` files are not listed yet: Nextcloud types them `application/octet-stream`.
  The e2e RAW is a `.NEF`; the fix is a `TODO.md` item.
- 2026-11-10: The subfolder listing pages by offset in file id order, since Nextcloud's search
  accepts only `eq` and `in` on `fileid`. A file added during a listing can shift a page; the
  client drops duplicates by file id (`mergeListings`).
- 2026-11-10: Decisions are stored per member file id (JPEG, RAW, each with the same values),
  not per pair, since a pair key changes with a rename and the server does not pair (ADR 0012).
- 2026-11-10: Decision writes send whole states, not changes, so undo resends the earlier state
  and a write is idempotent; a state equal to the default deletes the row (ADR 0012).
- 2026-11-10: The decision API does not check that a file id belongs to the user: rows are the
  user's own and touch no file, and a lookup per id would cost a file cache query (ADR 0012).
- 2026-11-10: The server keeps the resume positions of the 20 most recent folder sets per user,
  the length of *Recent*, with decided and total so *Recent* shows progress without a listing.
- 2026-11-10: A folder set holds at most 1,000 folders; colour labels are stored by name, so a
  reorder of the palette needs no migration.
- 2026-11-10: Saving a resume position deletes and re-inserts its row, so the new id orders it
  first when two saves land in the same second.
- 2026-11-10: A pair whose members carry different stored decisions takes the rendered member's,
  the one the user sees.
- 2026-11-10: The default sort counts the folders that hold pictures: one → *File name*, several
  → *Capture time*.
- 2026-11-10: The file-name sort compares base names, ties by folder.
- 2026-11-10: Filters and sort are per cull and reset on opening a folder set; they are not
  stored.
- 2026-11-10: *Clear filters* keeps the scope.
- 2026-11-10: Previews are warmed in the view's order when a folder set opens, before the
  decision lookup answers, so the warm-up does not wait for it.
- 2026-11-10: A failed decision lookup is logged and every photo shows as undecided; an answer
  for a folder set that is no longer open is dropped.
- 2026-11-10: The scope's "The flag filter overrides this" stays visible text beside the disabled
  segment, tied to it by `aria-describedby`: a tooltip on a disabled control shows only where the
  browser sends hover to it.
- 2026-11-10: Tapping the pressed star chip turns the rating filter off, like *Any*, as in the
  mockup.
- 2026-11-10: The colour swatches use the mockup's fixed palette, not Nextcloud variables, since
  a label's colour is data; names and colours sit in `src/colour-labels.ts` until the shared
  `ColourLabels` component exists.
- 2026-11-10: The empty states name the reason and offer *Show all* or *Clear filters*; the
  mockup's counts and *Review rejects* come with the reject review (M4).
- 2026-11-10: The untranslated-text check skips the `name` of an `input`: a form control's name is
  its key in the form and never shown.
- 2026-11-10: Selection mode (M2.6) keeps the selection to the shown pictures: a filter, scope or
  decision that hides a picture drops it from the selection, so a bulk change never reaches a
  photo the user cannot see.
- 2026-11-10: *Keep RAW*'s pressed state in the action bar is the common value over the selected
  pairs only; singles neither press nor block it.
- 2026-11-10: Bulk changes show at once and are stored with one `PUT /decisions`; a failed save
  logs the error, puts back what the change replaced and shows an error note, without
  `@nextcloud/dialogs` (a new dependency needs an ADR). Undo and its toast come with M3.2/M3.3.
- 2026-11-10: The tile overlays (stars, colour dot, flag mark, *Keep RAW* badge, selection check)
  land with M2.6 so a bulk change is visible in the grid.
- 2026-11-10: The colour palette opens inline above its button, not in an `NcPopover`; the label
  names and swatches stay in `src/colour-labels.ts`, which `ColourLabels` and `PhotoTile` share.
- 2026-11-10: M2.6 brings only Ctrl+A, Ctrl+D and Escape; the decision keys (P, X, U, 0–5, the
  label keys) come with M3.3, and *Move…* and *Delete…* join the action bar with M4 and M7.
- 2026-11-10: Leaving selection mode selects nothing; Ctrl+A enters selection mode, and a
  long-press or a Ctrl- or Shift-click on a tile does too.
- 2026-11-10: When two overlapping saves of the same file both fail, the revert shows the first
  change, which was never stored, until the next reload; that is rare and costs no data. The
  stored decisions read on open go under changes made before they arrive.
- 2026-11-10: The loupe's 100 % zoom shows the original file (image tier 0; the largest preview
  for a RAW-only picture), loaded only while zoomed; the pinch range runs from fit to 100 %.
- 2026-11-10: Loupe keys follow the plan's key map: `Tab` and double-tap toggle chrome-free mode,
  `F` browser fullscreen (the TODO item's "F" for chrome-free was the older wording). `Tab` and
  `Space` act only while the loupe itself has focus, so a focused control keeps them.
- 2026-11-10: "Collapsible sidebar" in M3.1 means the loupe covers the Nextcloud navigation and
  its own info panel and filmstrip collapse; a toggle for the app navigation is a TODO item.
- 2026-11-10: The loupe pages through a snapshot of the grid's view taken when it opens, so a
  decision that hides a picture does not shift the loupe; closing focuses the last picture.
- 2026-11-10: The loupe prefetches 3 ahead and 2 behind (paging forward is the common case) and
  shows the 512 px grid tier until the 2048 px tier has decoded.
- 2026-11-10: Overlays idle 2.5 s after the last touch in landscape only; a middle tap toggles
  them, a mouse move or a touch on an overlay wakes them, and a focused overlay control keeps
  them. Paging snaps without a slide animation in M3.1, and vertical swipes wait for M3.2.
- 2026-11-10 *(changed by the owner review)*: The info panel's open state and width are kept in the
  browser's local storage; the filmstrip starts open on each opening. The < 100 ms budget is not yet
  measured.
- 2026-11-10: The "Nextcloud app navigation" the loupe covers is Nextcloud's header with the app
  menu; honeycomb has no navigation of its own yet. A pressed toggle at the end of the title row
  shows the header above the loupe, kept in the browser like the info panel; chrome-free mode
  still covers it, and the loupe is no longer `aria-modal` while it shows.
- 2026-11-10: The gesture guide lists only what the loupe does today: sideways swipes, the tap
  zones with their sketch, pinch and double-tap, and the keys `←` `→`, `Z` and `Esc`. The swipe
  up and down line joins with M3.2 and the mockup's keys line (`P`, `X`, `U`, `Z`, `?`) with
  M3.3, so the guide, shown once, never names a gesture that does nothing.
- 2026-11-10 *(changed by the owner review)*: The gesture guide counts as seen in the browser's
  local storage, like the info panel; with site data blocked it shows on each opening. Showing it
  again from the settings is the UX review's L6 in `TODO.md`.
- 2026-11-10: The gesture guide's lines are plain translated sentences without the mockup's bold
  verbs, since markup inside a translated string needs `v-html`; key caps go through `t()` too.
- 2026-11-10: While the gesture guide shows, its *Got it* has the focus and the loupe's keys
  still work; *Got it* gives the focus back to the loupe. `Esc` closes the loupe without marking
  the guide seen.
- 2026-11-10: The < 100 ms budget for a prefetched next loupe image is measured by an e2e spec
  with three 24 MP JPEGs of about 11 MB drawn in the browser, since no real photos are
  available; `HONEYCOMB_BUDGET_PHOTOS` swaps in real ones. Measured locally: about 5 ms.
- 2026-11-10: The budget spec asserts only that paging makes no image request; the time is
  reported, not asserted, because tests use no wall clock and shared CI runners vary.
- 2026-11-10: The undo history (50 steps) and the undo toast are app-wide, so decisions from the
  selection bar get a toast too; redo and the undo keys wait for M3.3.
- 2026-11-10: After a pick or reject in the loupe, auto-advance goes to the next undecided
  picture after the shown one and stays when none follows; *Settings › Loupe gestures* turns it
  off (M4.4), and the "All photos decided" toast is M4.2.
- 2026-11-10: A swipe up picks and a swipe down rejects by default (`DEFAULT_SWIPES`, Q6);
  *Settings › Loupe gestures* sets each direction to Pick, Reject or Nothing (M4.4).
- 2026-11-10: Whether the flag buttons are shown is the per-user setting *Show flag buttons*
  (M4.4); `B`, the title-row flag and the toast's *Show* change it.
- 2026-11-10: The undo toast stays 5.2 s, as in the mockup; the landscape flag rail is 96 px wide.
- 2026-11-10: The key map (`src/logic/hotkeys.ts`) holds only keys that work; `N`, `Shift+K`, `M`,
  `Delete`, `Ctrl+Backspace` and the move dialog's `1`–`9` join it with M4, M6 and M7, and the
  user doc marks them *Coming in a later version*.
- 2026-11-10: `Caps Lock`, `Home`, `End`, `Z`, `F` and `\` are built as the plan's key table and
  the signed-off mockup say, though Lightroom's own list has not confirmed them yet.
- 2026-11-10: The gesture guide's keys line teaches `P`, `X`, `U`, `Z` and `?`, as in the mockup.
- 2026-11-10: The vi keys option is the per-user setting *Settings › Keyboard › Vi keys* (M4.4).
- 2026-11-10: `Shift+` decisions and `Caps Lock` go to the next photo unless the decision already
  moved (loupe auto-advance) or, in the grid, the photo left the filtered view; `Caps Lock` also
  advances `[` and `]`. On a selection with mixed ratings, `[` and `]` step from 0.
- 2026-11-10: `↑` and `↓` switch photo in the loupe, as `←` and `→` do.
- 2026-11-10: The shortcut sheet opens inside the loupe while it is open, so it lies above it.
- 2026-11-10: Hiding the flag buttons by `B` says "Flag buttons hidden · B shows them"; by a tap
  the toast still names the swipe and the flag at the top.
- 2026-11-10: `I` shows or hides the loupe's info panel instead of cycling an overlay, as the glossary's
  info panel is a panel; the plan, user doc and sheet say so.
- 2026-11-10: The shortcut sheet drops the mockup's rows without a key-map key (`Shift+click`,
  `Ctrl+wheel`); its vi group is titled "Vi keys (Settings › Keyboard)" since M4.4; the
  gesture guide labels its keys *Pick*, *Reject*, *Unflag*, *Zoom* and *All keys*.
- 2026-11-10: Trashing gets its own `TrashService` and `TrashController` instead of the plan's
  shared `FileService`, one responsibility each; moving and writing XMP get theirs in M5 and M7.2.
- 2026-11-10: The trash endpoint rechecks a file by the ETag the listing gave, not by mtime, as
  the ETag also changes on a write within the same second.
- 2026-11-10: Trashing refuses only files the listing lists (`image/*` or `.xmp`) and answers
  `notFound` for others, so a client bug cannot trash an unrelated file and nothing is revealed.
- 2026-11-10: With the trash bin app disabled the trash endpoint answers `409` and touches
  nothing, because `Node::delete()` would then delete for good (CLAUDE.md rule 2).
- 2026-11-10: *Retry failed files* resends only the failed and skipped files with their listing
  ETags; a `changed` file needs a reload of the folder, and its reason in the delete report says so.
- 2026-11-10: Decision rows of trashed files are kept (ADR 0013), so a file restored from the
  trash bin comes back with its decision.
- 2026-11-10: Rescuing in the reject review is an ordinary flag change to unflagged, recorded in
  the undo history with its toast.
- 2026-11-10: `Delete` on a single focused tile or the loupe's photo goes straight to the delete
  summary, like *Delete…* on the selection; only "delete rejected" goes through the review.
- 2026-11-10: After a delete the app takes the trashed files out of its listing and pairs a
  picture that lost a member again from what is left, instead of listing the folders again.
- 2026-11-10: The *All photos decided* toast replaces the Undo toast at once instead of after the
  mockup's 1.6 s, as tests have no timers; Undo stays on `Ctrl+Z`. It shows only when a flag in
  the loupe leaves no undecided photo in the loupe, and offers *Review rejects* only with rejects.
- 2026-11-10: Only `Delete` and `Ctrl+Backspace` are mapped, not plain `Backspace`, so a stray
  Backspace never opens a delete; the cull keys pause while a delete dialog is open.
- 2026-11-10: A failed trash request changes nothing on screen and says why in a toast: the trash
  bin being off (`409`) by name, anything else as "reload the folder to see what changed".
- 2026-11-10: The shortcut sheet's group is "Undo, delete and help" (the mockup's "move" waits
  for M5); the reject review's confirm is the danger button, as in the mockup.
- 2026-11-10: *Remove RAWs* reuses the trash endpoint unchanged: each RAW and its own sidecars go
  as one picture, whose member-first order keeps the sidecar when the RAW fails (ADR 0013).
- 2026-11-10: A RAW's own sidecars are `<raw>.xmp` and darktable's duplicates `<raw-base>_NN.<ext>.xmp`,
  matched ignoring case, as pairing assigns them; `<jpeg>.xmp` and the shared `<base>.xmp` stay.
- 2026-11-10: A pair both marked *Keep RAW* and rejected counts as "marked Keep RAW" in the skipped
  line and shows in *RAW stays*, as in the mockup, so the marked group is complete.
- 2026-11-10: The *Remove RAWs* summary keeps the view as it was opened, so a Keep RAW toggle moves
  a photo between its groups even when a *Keep RAW* filter would hide it from the grid.
- 2026-11-10: The reject review and the *Remove RAWs* summary share one thumbnail grid component
  (`PictureThumbs`); red frames mark photos whose files go, honey frames photos that stay.
- 2026-11-10: *Remove RAWs…* sits only in the grid's ⋯ menu, as in the mockup; the loupe has no ⋯
  menu, and like deleting it has no single-key shortcut.
- 2026-11-10: The delete report's `removed` count is now per sent picture — every member it sent
  went — so a RAW unit counts once its RAW is gone; for whole pictures the count is unchanged.
- 2026-11-10: Per-user settings are one JSON object in `IUserConfig` behind
  `GET`/`PUT /api/v1/settings` (ADR 0014); the server checks only object and size, all field
  rules are in `src/logic/settings.ts`, and the browser-storage values `honeycomb.flagButtonsShown`
  and `honeycomb.viKeys` are dropped without migration.
- 2026-11-10: A settings change applies at once and saves the whole object; a failed save keeps it
  for the visit and says "Could not save the settings; they apply until you reload." A change made
  before the stored settings arrive wins over that one field and is saved once they are read;
  after a failed read nothing is saved, so the stored settings are never overwritten blind.
- 2026-11-10: The settings dialog is `NcAppSettingsDialog` with the mockup's File types, Folder
  layout, Loupe gestures and Keyboard sections, opened from *Settings* in the grid's ⋯ menu;
  *Moving photos* and the storage section wait for M5 and M7.
- 2026-11-10: An extension is letters and digits only; the dialog refuses an empty one, `xmp`, one
  with other characters and one already in either list, and keeps the last one of each list. It
  stores extensions in lower case and shows them as `.NEF`, as the mockup does.
- 2026-11-10: Switching to *Separate subfolders* starts from `RAW` and `JPG`; custom subfolder
  names are not kept while the mode is *Same folder*, and an empty name takes its default. Names
  apply when the field is left, not per keystroke, so the cull is not re-paired while typing.
- 2026-11-10: The swipe choices are a native `select`, which the iPad shows as its own picker.
- 2026-11-10: A change of the extensions or the folder mode re-pairs the open cull from its
  listing, keeps the decisions, looks up those of newly paired files and clears the selection.
- 2026-11-10: With *Show singles* off, singles leave the cull entirely, also a JPEG whose RAW
  *Remove RAWs* just removed; the folder picker's count still counts them.
- 2026-11-10: Auto-advance off leaves the loupe on the photo after a pick or reject; `Shift+`
  keys and `Caps Lock` still go on. The gesture guide names only the swipes that decide.
- 2026-11-10: Hidden by a tap while no swipe decides, the flag buttons' toast says "Flag buttons
  hidden, and no swipe decides: the flag at the top shows them"; by `B` it still names the key.
- 2026-11-10: Keys are off while the settings dialog is open, as while the folder picker is.
- 2026-11-10: Specs follow Framehive's model (IDs, numbered Given / When / Then criteria, `spec:`
  markers on tests, `Spec-Unchanged:` / `Spec-Only:` trailers) rather than JIT-Pack's or
  skipper-cd's review-only rule, because only Framehive's fails CI when spec and code part (ADR 0015).
- 2026-11-10: Specs live in `docs/specs/`, not a top-level `specs/`, so CI's path groups treat them
  as docs and a spec-only pull request skips the PHP and TypeScript jobs.
- 2026-11-10: The trailer check judges the pull request as its squash commit (changed files, title
  and description), not each commit as Framehive does: a test-first commit never touches the spec.
- 2026-11-10: Behaviour code for the trailer check is `lib/`, `src/`, `appinfo/`, `templates/` and
  `css/`; tests, scripts, workflows and docs need no trailer.
- 2026-11-10: A criterion the merged code does not do yet, or that no test proves, stays in the
  spec marked `(gap)` and must be named by a `TODO.md` item (`scripts/specs.sh`), so a gap is
  listed instead of dropped; Framehive has no such marker.
- 2026-11-10: No pull request template: the description becomes the squash commit body word for
  word, so template text would land in `main`. The trailer rule is in `docs/02-workflow.md` §2.5.
- 2026-11-10: M5 is split into M5.1 (the pure TypeScript model, parser, serializer and mapping),
  M5.2 (sidecar endpoints and the shared flag) and M5.3 (wiring into the cull), so each pull
  request stays reviewable; the pure part comes first because both others build on it.
- 2026-11-10: The XMP time is formatted from an epoch and a UTC offset in minutes passed in, not
  from `Date`'s local zone, so serializing stays deterministic in tests (CORE-009 Clock port).
- 2026-11-10: The fixtures for CORE-009's forms are written for honeycomb, not copied from
  Framehive (GPL-3.0-or-later); `canonical.xmp` states the same model as Framehive's, so equal
  bytes show both write the same form.
- 2026-11-10: A sidecar holding NUL characters is refused as not UTF-8, so UTF-16 without a byte
  order mark, which fatal UTF-8 decoding accepts, is caught too (XMP-001.5).
- 2026-11-10: A refused sidecar is reported by throwing a typed `XmpError` with its reason and,
  where the parser gives one, line and column, rather than returning a result union.
- 2026-11-10: The `honeycomb` namespace is added to the preferred prefixes, so `honeycomb:KeepRaw`
  is always written with that prefix.
- 2026-11-10: Setting a property honeycomb writes keeps that property's existing qualifiers; only
  the value text changes (CORE-009.23).
- 2026-11-10: A sidecar honeycomb creates goes next to its member, `<member path>.xmp`, also when
  the members of a pair sit in different folders.
- 2026-11-10: Sidecar bytes travel as base64 in JSON, so a sidecar that is not UTF-8 reaches the
  pure module whole and it reports it (ADR 0017).
- 2026-11-10: A sidecar request carries at most 1,000 sidecars of at most 1 MiB each; a larger
  sidecar answers `tooLarge` (ADR 0017).
- 2026-11-10 *(changed by the owner review)*: Public links and mail shares do not make a folder
  shared; only other users, federated users and group folders do, since only they edit the sidecars
  (ADR 0017).
- 2026-11-10 *(changed by the owner review)*: External storage mounted for several users is not
  detected as shared; Nextcloud offers no reliable signal for it (ADR 0017).
- 2026-11-10: The client wrappers for the sidecar endpoints come with M5.3, which first uses them,
  so M5.2 adds no unused TypeScript.
- 2026-11-10: M5.3 takes over no decision from sidecars that state none (undecided), so an empty
  sidecar stores no rows and a later decision in another program can still be taken over.
- 2026-11-10: The colour label counts as changed for darktable's list when it differs from the
  label the sidecar itself states, not from honeycomb's stored one, so a sidecar already showing
  the label keeps its whole darktable list.
- 2026-11-10: Failures of a write-through, which runs in the background, are a toast with
  *Details* rather than a dialog, so a decision is never interrupted; the dialog opens on request.
- 2026-11-10: *Write decisions to sidecars…* writes only the pictures in shared folders with a
  stored decision for a member; undecided pictures have nothing to write.
- 2026-11-10: A refused or disagreeing sidecar found when a cull opens is only logged as a
  warning, since the user has not asked for anything yet; it is reported when a write meets it.
- 2026-11-10: Sidecar writes run one after another in one queue, each reading the decision when it
  starts, so two quick steps on one picture never save over each other's ETag.
- 2026-11-10: A new sidecar whose save answers `changed` (another program created it meanwhile) is
  reported as failed rather than retried; only existing sidecars are read and merged once more.
- 2026-11-10: A failed save of the decisions taken over from sidecars is only logged; they still
  show and are taken over again when the cull next opens.
- 2026-11-10: The sidecar failure report has its own list (path and reason) instead of
  `TrashFileList`, whose rows need a listed file and a created sidecar has none.
- 2026-11-10: *Retry failed sidecars* writes only the failed files, not every sidecar of their
  pictures, so the sidecars that were saved are not written twice.
- 2026-11-10: `sameDecision` moves to `src/logic/decision.ts`, shared by the undo, XMP and
  sidecar modules instead of three private copies.
- 2026-11-10: The XMP test fixtures are read by path (`import.meta.dirname`) instead of `new URL`,
  which happy-dom replaces, so component tests can use them.
- 2026-11-10: M6 is split: M6.1 ships the series compare dialog, pick-rest and the toolbar button;
  the fullscreen series viewer and the tile series badge move to M6.2, so a PR stays reviewable.
- 2026-11-10: A series needs one camera (EXIF make and model, added to the listing per ADR 0009)
  and an EXIF capture time; file times are left out because copied files share them.
- 2026-11-10: A run longer than four is split evenly (5 → 3 + 2), so no series is a lone photo.
- 2026-11-10: Series are found over all pictures of the cull after rejects are removed, not the
  filtered view, and a series is offered only while it holds an unflagged picture.
- 2026-11-10: `N` opens the series compare from the grid only; in it, tapping a card makes it the
  active photo until the series viewer exists.
- 2026-11-10: The series viewer is built from the loupe's stage, action bar, navigation buttons,
  flag button toggle, idle timer and prefetch; the stage keeps its zoom across paging by a
  `keepZoom` prop, and a double-tap in the middle toggles 100 % instead of the chrome-free mode.
- 2026-11-10: The series viewer's state lives in `src/series-viewer.ts`: it shows the series
  without its rejected pictures and tracks the shown picture by identity, so a reject shows the
  next photo (the previous after the last) and an undo that brings a photo back shows it.
- 2026-11-10: Fewer than two photos left close the series viewer and the compare shows the next
  series, so *Pick this, reject the rest* closes it too; an undo after that restores the flag only.
- 2026-11-10: Tapping a card's photo in the series compare opens the series viewer on it instead of
  making it active; the arrow keys still switch the active card. `Enter` does not open the viewer,
  as the key map has no command for it. Closing the viewer makes the viewed photo active.
- 2026-11-10: The series viewer's title row has the close button, the name, "Series 1 of 2 · photo
  2 of 3", the flag button toggle and *Fit* / 100 %; no info panel, filmstrip, Nextcloud
  navigation toggle or gesture guide.
- 2026-11-10: A decision in the series viewer goes through the same path and undo toast as the
  compare and never moves on by itself; `Shift` with a decision key moves on, except a reject,
  which already takes the photo out. Swipes follow the swipe settings and do not decide while
  zoomed.
- 2026-11-10: The series viewer prefetches the whole series when it opens, and the compare stays
  hidden while the viewer is open.
- 2026-11-10: The series badge "⧉ N" marks a tile whose picture is in an offered series; it is
  read-only, with "Series of N" in the tile's label, and sits at the top end below the ambiguity
  mark, as the bottom end holds the selection check.
- 2026-11-10: No Playwright test for the series viewer yet: the e2e fixtures have no capture times,
  so they form no series; the viewer is covered by Vitest component and App tests.
- 2026-11-10: The name template module formats the capture time as stored, which is the camera's
  clock (Nextcloud reads EXIF without a zone, as UTC); the modification time fallback is shifted
  by the UTC offset the caller passes, so it shows the user's local time.
- 2026-11-10: `{name}` falls back to `unknown` like `{camera}` and `{make}` when the base name is
  empty after sanitising (`写真.jpg`), so no rendered folder or file name is ever empty.
- 2026-11-10: Template problems are codes with a column (from 1), worded by the settings in M7.4;
  problems in the text are reported left to right before problems in the folder structure.
- 2026-11-10: Undo of a move does not bring replaced files back from the trash bin: restoring is not
  public API (ADR 0013), so they stay there, restorable, and folders the move created stay (ADR 0018).
- 2026-11-10: The client probes the target folders for every child, not the listing, because a
  file of a type the listing skips (`.CR3` as `application/octet-stream`) still takes its name.
- 2026-11-10: The move endpoint keeps the new name as sent and checks no extension: renaming is the
  user's right in Nextcloud, and the user's folder and its permissions are the boundary (ADR 0018).
- 2026-11-10: A move rolls a picture back through `Node::move()` when one of its files fails, unlike
  the trash, which cannot restore; a file that cannot go back is reported `moved` at its new path.
- 2026-11-10: *Replace* on a conflict with a file the same move takes away falls back to *Add
  suffix*, since the server refuses to replace a file of its own request (MOVE-003.5).
- 2026-11-10: M7.2 adds no Playwright test: it has no UI yet; the move dialog's e2e comes with M7.3.
- 2026-11-10: A move that rolls back leaves the folders it created, empty: another picture of the
  same move may already use them, and an empty folder loses nothing (ADR 0018).
- 2026-11-10: A move is undone only by its toast's *Undo*; `Ctrl+Z` keeps undoing decisions only
  (MOVE-004).
- 2026-11-10: Moved files leave the listing by `cull.removeFiles`, the loupe follows by
  `followReplaced` and the selection drops them; *Undo* re-adds them by `cull.restoreFiles`.
- 2026-11-10: The target picker forbids the folders of the open folder set; a target below a set
  folder (subfolders on) hides the moved pictures until the set is reopened.
- 2026-11-10: When a moved file's new file id differs from the old one (across storages), the toast
  adds that decisions did not move with the files.
- 2026-11-10: The move dialog names files by `DEFAULT_NAME_TEMPLATE`; the template text is an
  input of the move flow until the setting arrives (M7.4).
- 2026-11-10: A picture's new name uses the times and camera of its rendered member, else of its
  RAW member.
- 2026-11-10: `moveFavourites` and `moveRecent` (the 5 last targets) live in the settings blob
  (SETTINGS-001.15).
- 2026-11-10: With a *Replace* chosen, the move summary's note adds that replaced files stay in the
  Nextcloud trash bin; the move texts live in `src/move-text.ts`.
- 2026-11-10: Failed files open a move report without retry; a failed probe or move closes the
  dialog with a toast, and a 409 says the Nextcloud trash bin is off.
- 2026-11-10: The move summary shows the name template without a "change it in Settings" hint.
- 2026-11-10: The view state has its own endpoint (ADR 0019) rather than the settings object, so
  writing one key never races a whole-object settings save; "view state" joins the glossary.
- 2026-11-10: Until the view state has loaded, the info panel shows closed and the gesture guide
  counts as seen, so the guide never flashes; a change made before the answer wins and is not
  migrated over.
- 2026-11-10: The info panel's width, the Nextcloud header toggle and the tile size stay in the
  browser, since they depend on the device's screen.
- 2026-11-10: A local view-state value other than `true` or `false` is ignored and left alone; a
  failed migration save is only logged and the local keys stay, so the next visit tries again.
- 2026-11-10: Opening the loupe moves from `App.vue` to `src/loupe-opening.ts`, which kept
  `App.vue` under 300 lines.
- 2026-11-10: The e2e tests reset the shared admin's view state after each page load, so server
  state never leaks between tests.
- 2026-11-10: The move flow reads the name template from the settings; its separate template input
  is gone, so the setting is the one source.
- 2026-11-10: A stored name template that no longer parses reads as *By day*, so a move never runs
  on an invalid template.
- 2026-11-10: Each keystroke that leaves a valid template saves it, as the mockup shows; an invalid
  one stays a draft and moving keeps the last valid template.
- 2026-11-10: The empty folder and empty name problems get their own words ("Empty folder name;
  remove the extra /", "The name needs something before .{ext}"), since the mockup's catch-all
  read wrong for them; a bad `{number}` width shares "Unknown option in …" with a bad modifier.
- 2026-11-10: The preview's five samples have fixed times at offset 0, so it reads the same on
  every device and test run.
- 2026-11-10: The preview notes an unknown camera only when the template uses `{camera}` or
  `{make}`, since otherwise the name does not depend on it.
- 2026-11-10: The l10n test skips elements marked `translate="no"`, which hold data such as file
  names and paths rather than UI text.
- 2026-11-10: The resume position follows the picture the loupe shows, not the grid's focus:
  arrowing through tiles is not culling, and each focus step would be a request (DECISIONS-002.7).
- 2026-11-10: Position saves are sent one at a time, only the latest of those that waited, so
  paging fast costs no burst of requests and needs no timer (DECISIONS-002.7).
- 2026-11-10: *Resume* opens at the first undecided picture of the view when the filters hide
  the stored one, as the mockup does (DECISIONS-002.9).
- 2026-11-10: The stored position is offered by a toast and the More menu item *Resume at
  <name>*, as in the mockup; the toast is skipped once the loupe has shown a picture.
- 2026-11-10: *Recent* lives in an `NcAppNavigation` with *Folder* (opens the picker) and
  *Settings* as in the mockup; the mockup's *Cull* entry is left out, since the grid is the only
  content and the loupe closes by its own controls (DECISIONS-002.8).
- 2026-11-10: *Recent* lists all positions the server keeps (20), not the mockup's 8, since the
  server already caps the list and the navigation scrolls (DECISIONS-002.8).
- 2026-11-10: The picker shows *Recent* above the folders, headed *Recent* and *Folders*, since
  the mockup's picker only names Recent in its hint (LISTING-003.13).
- 2026-11-10: Tapping a recent folder set opens the loupe at its position directly, without the
  *Continue where you left off* toast, since the tap already chose to continue; tapping the open
  folder set resumes it without listing it again (DECISIONS-002.8).
- 2026-11-10: A saved position moves its folder set to the top of *Recent* locally; the list is
  read from the server at start and whenever the picker opens, not after each save
  (DECISIONS-002.8).
- 2026-11-10: The root folder is named *Home* under *Recent*, as in the picker's breadcrumbs.
- 2026-11-10: The navigation closes on a narrow screen after a tap on *Folder* and *Settings*
  too, not only on a recent folder set, as in the mockup (DECISIONS-002.12).
- 2026-11-10: A narrow screen is `useIsMobile()` of `@nextcloud/vue` (below 1024 px), where
  `NcAppNavigation` covers the content, not the mockup's 1000 px (ADR 0020).
- 2026-11-10: The grid shows one notice per ambiguous base name of a folder, as the mockup does,
  not one per folder; it counts the singles the filters show and sits above the grid beside the
  save-failure notice (`GridNotices`), so the virtual grid's layout stays untouched
  (LISTING-002.11).
- 2026-11-10: LOUPE-001.17 needed no code: the loupe never had a transition, so the gap closed
  with a guard test.
- 2026-11-10: LOUPE-002.11 needed no code: the layout was right, so the gap closed with a
  geometry e2e test.
- 2026-11-10: A move across storages carries only the moving user's decision rows to the new file
  id, as the decision store is per user; other users' rows stay for the clean-up job. Resume
  positions are not carried over: a moved picture has left the folder set whose position names it.
- 2026-11-10: A decision row that cannot be carried over is logged as an error and the file is
  still reported `moved`: the files are where the user wanted, and the API keeps its shape.
- 2026-11-10: The clean-up job keeps a resume position whose picture is deleted for good: the
  folder set may still exist, *Recent* keeps listing it and resuming falls back to the first
  picture. Positions are bounded at 20 per user; a deleted user's positions go with the user.
- 2026-11-10: A deleted user's rows are removed on `UserDeletedEvent`, not by the job checking
  whether users exist: a user backend that is briefly unreachable must not wipe a user's cull.
- 2026-11-10: The TODO item's grid arrow keys were already built (KEYS-001.5); only `ConfirmDialog`'s
  phone bottom sheet was left. It takes the mockup's 520 px breakpoint, not NcModal's 512 px, and
  is restyled from NcModal's classes, since `NcDialog` offers no sheet layout.
- 2026-11-10: The shared tooltip is `AppTooltip.vue` (component names have two words, like
  `AppIcon`) with the bubble id `honeycomb-tip`, so it cannot clash with an id in Nextcloud's page.
- 2026-11-10: The tooltip's colours are Nextcloud's main text and background colours swapped, so
  it follows the theme without colours of its own; it has no fade, so reduced motion needs no
  exception.
- 2026-11-10: Components tell the tooltip about their areas by data attributes, not props:
  `data-tips-off` while the loupe's or series viewer's controls fade out, `data-tip-avoid` on the
  photo's stage, `data-tip-hover-only` on a grid tile; the one bubble reads them from the page.
- 2026-11-10: The tooltip catches *Escape* on the window in the capture phase, ahead of every key
  handler, so the first *Escape* only hides it without each handler knowing about it.
- 2026-11-10: The tooltip shows inside the loupe or series viewer while one is open, as the
  browser shows nothing outside a full-screen element.
- 2026-11-10: Tooltips go on every icon-only control and on the controls whose mockup tooltip
  names a key (*Move this photo*, *Info panel*, *Fit / 100 %*, the flag, star and colour buttons);
  the native `title`s of the grid toolbar, series badge, series compare and *Pick this, reject the
  rest* became tooltips.
- 2026-11-10: PR 78 has no screenshots: the assets repository `polandy/honeycomb-assets` that
  `docs/02-workflow.md` §2.7 names does not exist, and creating a public repository is the
  owner's call; the Playwright run and the component tests stand in until it exists.
- 2026-11-10: The TypeScript unused-export gate is glissando's `unused-exports` analyser, ported
  and taught Vue script blocks, not knip: it needs no new dependency (it parses with the
  `typescript` package already locked) and so no ADR. It judges `src/` except `src/main.ts`;
  tests, scripts and config count only as importers, and a component's own exports are not
  judged.
- 2026-11-10: The no-raw-error-text gate is a local ESLint rule on `src/`, not a selector: it
  follows the binding of a `catch` clause and of a `.catch()` or `.then()` rejection handler and
  refuses reading its text (`message`, `stack`, `toString()`, `String()`, `JSON.stringify()`, a
  template string or `+`). Passing the error on, logging it, `instanceof` and rethrowing stay
  allowed, since the `*Text()` mappers take the error and check its type. An alias
  (`const e = error`) escapes it; review catches that.
- 2026-11-10: UX review L1 is fixed in the mockup and the app in one PR, so the two never
  disagree: a tile is a skeleton tile until its small preview loaded or failed, and skeleton
  tiles replace the grid and its toolbar while a folder set from *Recent* is listed. The folder
  picker needs no skeleton, as its confirm button waits for the listing it counts.
- 2026-11-10: The skeleton pulse is a background-colour pulse between two Nextcloud background
  variables, still with reduced motion; a shimmer gradient would add motion for no extra meaning.
- 2026-11-10: UX review L2: at 520 px and below the mockup's slim row replaces the three scope
  icons with one button naming the active scope that opens the scopes as a menu; the name fits
  at 360 px in English and German, a shorter label would break the glossary's words, and the
  scope changes rarely, so one more tap costs little. The app bar keeps its three icons while
  scrolling. The app needs no change: its scope switch already shows text labels.
- 2026-11-10: UX review L3: in a series compare card narrower than 200 px the mockup's *Pick
  this, reject the rest* drops its icon (the *Pick* button above shows the same flag), narrows
  its padding to 8 px and balances its wrap, so it takes two lines from 320 px up in English. A
  shorter label would break the glossary's words; one column would end the side-by-side
  compare. German still takes three lines at 320 px. The app's button ellipsizes instead of
  wrapping; that fix is its own `TODO.md` item, because it needs an e2e check at phone width.
- 2026-11-10: UX review L4: the mockup's toast stops its timer while focus is inside it or a
  pointer is pressed on it, and restarts the full 5.2 s once both end, so a reader who paused
  gets the whole time back rather than a remainder that may be gone in a blink. Hover does not
  hold it: touch has no hover, and the rule is about focus and press. The app's toast still
  times out regardless; that fix is its own `TODO.md` item, because it needs Vitest and e2e
  checks.
- 2026-11-10: UX review L4 in the app: `useToast` holds the toast while focus is inside it or a
  pointer is pressed (`UndoToast` reports both) and restarts the full 5.2 s once both end, as
  the mockup does. A hidden toast forgets the hold, since an element removed under focus sends
  no `focusout`.
- 2026-11-10: UX review L5: the mockup's filmstrip shows every photo at full opacity and marks
  the current one only by its honey outline, and a grid tile draws its bottom shade only behind
  stars, a colour dot or a flag. Two dimmings stay, because they mark a state rather than
  decorate: a rejected tile, and a rejected photo in the filmstrip that leaves the *not
  rejected* scope. The app's tile has no shade; its filmstrip dims at 0.7, which is its own
  `TODO.md` item.
- 2026-11-11: The loupe budget e2e flake (one `size=2048` request after paging) came from the
  test, not the prefetch: its *neighbours loaded* counter leaves out the shown picture, whose
  loupe tier could still land after the test started counting requests. The test now also
  waits for the stage to swap to that tier, which happens only once the prefetch has decoded
  it, so production needs no new seam. Holding the first decode reproduces the old failure;
  a build without neighbour prefetch still fails the test.
- 2026-11-11: UX review L6: *Settings › Loupe gestures* gains *Show the gesture guide*, which
  marks the guide unseen so it shows on the next loupe opening, rather than opening the loupe
  from the dialog; the settings dialog opens from the grid, and jumping views from a dialog
  would surprise. The button keeps focus and stays enabled; its hint says the guide comes next
  time. The app keeps this as its own `TODO.md` item.
- 2026-11-11: UX review L7: the mockup's toolbar count badges are neutral (the border colour,
  and a translucent white in the dark app bar) and turn honey only while their button is
  pressed (*Select* in selection mode, *Filters* while its panel is open). The *Review rejects*
  and *Compare series* counts stay neutral, since honey marks a state, not an amount. The app's
  `GridToolbar` badges use the primary colour always, which is its own `TODO.md` item.
- 2026-11-11: UX review L7 in the app: the neutral `GridToolbar` badge uses
  `--color-background-darker` with the main text colour, the Nextcloud counterpart of the
  mockup's border colour that keeps the count legible in both themes; pressed, it uses the
  primary element colours (GRID-001.14).
- 2026-11-11: UX review L8: the mockup's app bar follows the theme through `--hdr-*` tokens:
  white with the main text colour and a border line in the light theme, the near-black bar
  only in the dark theme. The logo's outline strokes use `currentColor`, so it stays visible
  on both. The app needs no follow-up: it has no app bar of its own and sits under
  Nextcloud's themed header.
- 2026-11-11: Transifex sync files added per ADR 0007 although issue #17 was closed without an
  answer: they are inert until the owner requests translations, and the `main` ruleset question
  stays with the owner (recommendation (a), an organization with a bot bypass).
- 2026-11-11: `.CR3` and `.SRW` files are listed, served and previewed by their extension, not by
  a mime type mapping: an app cannot extend Nextcloud's mapping through public API, and files
  already scanned would keep `application/octet-stream` until an admin repairs the file cache.
- 2026-11-11: The by-name set is the fixed `cr3` and `srw`, the default RAW extensions Nextcloud
  35 does not map; a RAW extension the user adds in the settings is listed only when Nextcloud
  types it `image/*`, since listing by the user's list would change the entries API (ADR 0001).
- 2026-11-11: The RAW preview provider is registered for `application/octet-stream` too and is
  available there only for those extensions, so other untyped files still get no preview.
- 2026-11-11: The scope control (*Not rejected* / *Undecided* / *All*) is replaced by the
  combinable flag filter on the owner's request; *Undecided* and its "Every photo is decided"
  empty state go. The scope was never stored, so there is no value to migrate. *Clear filters*
  and the toolbar count treat the flag filter like any group, against its default.
- 2026-11-11: `docs/mockup/index.html` still shows the old scope control; it is not redrawn here.
- 2026-11-11: The loupe stage fits a photo by its loaded image's aspect once it has loaded, ahead
  of the listing's size. Previews are always drawn upright, while a listing size can disagree
  with them (Nextcloud reports `photos-size` turned, but only when it also read the EXIF
  orientation), so the drawn image is the one source that cannot distort an EXIF-rotated photo.
- 2026-11-11: Loupe neighbours are moved aside by `translateX(±100%)` on a full-width slide and
  hidden with `visibility: hidden` until a drag moves them in, rather than only clipped by the
  stage, so no browser (iPad Safari, fullscreen) can show them beside the shown photo.
- 2026-11-11: The loupe's *Fullscreen* button sits in the title row, not on a separate culling
  stage, because the loupe is the culling stage and `F` already fullscreens its root. Toasts and
  dialogs mount outside that root, so they do not show in fullscreen; left as is, owner asked for
  no other change.
- 2026-11-11: The grid keeps six image loads in flight (owner asked for 6–8): core renders four
  previews at a time, so six keeps it busy with two finishing transfer, and stays below what
  exhausted nc-test's database connections. Order: visible small, visible sharp, nearby small,
  nearby sharp; a visible tile's sharp image is worth more than an offscreen one's small.
- 2026-11-11: The loupe's tier is core's largest preview, 4096 px, not 1024 px, by measurement on
  the e2e Nextcloud (24 MP JPEG): the first request of any size renders the 4096 px preview first
  (1.0–1.2 s), after which 4096 is served in 0.1 s and 1024 in 0.1–0.27 s; 4096 weighs about
  1.2 MB against 76 kB. A 1024 px image would be scaled up two- to threefold on an iPad's loupe
  (2316–2752 px), too soft to judge focus, and the loupe loads one image and its neighbours, not
  the grid's dozens.
- 2026-11-11: The grid's tile queue takes a settle callback, not a promise, so a tile's sharp
  load is queued before the queue starts the next waiting one; PhotoGrid's styles moved to
  `photo-grid.css` to keep the component under 300 lines.
- 2026-11-12: The toolbar's "x of y decided" counts the pictures that pass the filters, so y equals
  the grid's picture count; the progress saved with a recent folder set stays over every picture.
  The toolbar is compact (13 px text, 16–18 px icons, 28 px chips, 32 px buttons) and keeps the
  44 px touch target through a larger hit area on coarse pointers, not a larger look.
- 2026-11-12: The loupe filmstrip is a dark band (`#111`) with a white border on the shown photo in
  every theme, a fixed colour against the rule of theme variables, because the owner's Lightroom
  reference asks for it and a light band would compete with the photo. Photos are 56 px squares.
- 2026-11-12: The filmstrip pads both ends by half its width so the first and last picture sit in
  the middle too, and renders only the photos in view plus four on each side, so a folder of
  thousands costs no more than one of twenty.
- 2026-11-12: *Pin the filmstrip* and *Pin the rating row* are per-user settings in the *Loupe
  gestures* section, off by default so the photo keeps the most room as before. Pinned, they sit
  below the photo in landscape (portrait already stacks them below); the chrome-free mode still
  hides them, since the user asked for it. Showing or hiding the Pick and Reject buttons was
  already the *Show flag buttons* setting and `B`; this change only adds a test that the keys
  decide while they are hidden. The mockup is not redrawn for the filmstrip look.
- 2026-11-12: Drag selection starts only after the tile's long-press, also in selection mode;
  iOS Photos also starts it from a sideways swipe in selection mode, but here a swipe always
  scrolls, so scrolling never turns into selecting by surprise. The range follows grid order
  from the pressed tile (not a rectangle), and dragging back deselects only what this drag
  added. Auto-scroll runs within 48 px of the edge at up to 16 px a frame, scaled by how deep the
  finger is in that band. The pressed tile's row stays rendered during the drag because a
  touch's events keep going to the element it started on.
- 2026-11-12: Warming renders in the request (16 files at most, the client sends 4 at a time, 4
  requests in flight) instead of a QueuedJob, which waited for cron for up to 5 minutes; the
  grid's own image loads and the warm-up share core's four renders, and the QueuedJob is gone.
- 2026-11-12: The screenshots of `docs/ux-review-2026-11.md` live in `polandy/honeycomb-assets`
  under `ux-review-2026-11/`, not `pr-<n>/`: the review document links them after the merge, and
  `pr-<n>/` folders are pruned then. They show synthetic photos, never the owner's.
- 2026-11-12: UX H1 — pressed Pick and Reject use the app tokens `--honeycomb-pick-fill` and
  `--honeycomb-reject-fill` (`src/flag-fills.css`) with a white icon, because Nextcloud 35's success
  and error colours are pale tints.
- 2026-11-12: UX H2 — a tile's flag mark, stars and colour dot sit in one row on a fixed dark
  bottom gradient with white stars (GRID-001.16), because the photo, not the theme, is their
  background; the colour dot moved from the top-left to that row.
- 2026-11-12: UX H3 shows the zoom as a pressed *Fit / 100 %* icon button; the zoom percentage is gone from the title row, the tooltip keeps the name.
