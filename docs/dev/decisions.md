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
- 2026-11-10: Specs live in `docs/dev/specs/`, not a top-level `specs/`, so CI's path groups treat them
  as docs and a spec-only pull request skips the PHP and TypeScript jobs.
- 2026-11-10: The trailer check judges the pull request as its squash commit (changed files, title
  and description), not each commit as Framehive does: a test-first commit never touches the spec.
- 2026-11-10: Behaviour code for the trailer check is `lib/`, `src/`, `appinfo/`, `templates/` and
  `css/`; tests, scripts, workflows and docs need no trailer.
- 2026-11-10: A criterion the merged code does not do yet, or that no test proves, stays in the
  spec marked `(gap)` and must be named by a `TODO.md` item (`scripts/specs.sh`), so a gap is
  listed instead of dropped; Framehive has no such marker.
- 2026-11-10: No pull request template: the description becomes the squash commit body word for
  word, so template text would land in `main`. The trailer rule is in `docs/dev/02-workflow.md` §2.5.
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
  `docs/dev/02-workflow.md` §2.7 names does not exist, and creating a public repository is the
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
- 2026-11-11: `docs/dev/mockup/index.html` still shows the old scope control; it is not redrawn here.
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
- 2026-11-12: The screenshots of `docs/dev/ux-review-2026-11.md` live in `polandy/honeycomb-assets`
  under `ux-review-2026-11/`, not `pr-<n>/`: the review document links them after the merge, and
  `pr-<n>/` folders are pruned then. They show synthetic photos, never the owner's.
- 2026-11-12: The tag entry (`docs/dev/mockup/tag-entry.html`): `T` opens it for the loupe picture
  or the selection; Tab and Shift+Tab cycle the matches into the field; Enter assigns exactly the
  field, creating the tag if new; the entry stays open; Backspace in the empty field and a chip's
  `×` remove, from all selected pictures. A tag on only some of them shows as a partial chip.
- 2026-11-12: UX H1 — pressed Pick and Reject use the app tokens `--honeycomb-pick-fill` and
  `--honeycomb-reject-fill` (`src/flag-fills.css`) with a white icon, because Nextcloud 35's success
  and error colours are pale tints.
- 2026-11-12: UX H2 — a tile's flag mark, stars and colour dot sit in one row on a fixed dark
  bottom gradient with white stars (GRID-001.16), because the photo, not the theme, is their
  background; the colour dot moved from the top-left to that row.
- 2026-11-12: UX H3 shows the zoom as a pressed *Fit / 100 %* icon button; the zoom percentage
  is gone from the title row, the tooltip keeps the name.
- 2026-11-12: UX H4 opens the loupe info panel as a fixed bottom sheet at 520 px and below, at
  most 60 % of the height, over the action bar; CSS only, so the dragged width stays for wider
  screens.
- 2026-11-12: UX H5 lays the title row out in the flow, not over the photo, while the filmstrip
  is pinned in landscape, and keeps it from idling like the filmstrip; unpinned, both still float.
- 2026-11-12: iPad feedback, portrait: the large flag buttons run *Pick*, *Unflag*, *Reject* in
  the DOM too, so the focus order matches the row; the small buttons keep *Pick*, *Reject*,
  *Unflag*.
- 2026-11-12: iPad feedback, folder picker: *Include subfolders* sits directly above the folder
  list, below *Recent*, since it applies to the ticked folders and not to a recent folder set.
- 2026-11-12: iPad feedback, landscape: the filmstrip is pinned from a pin toggle in the loupe's
  title row, bound to the existing *Pin the filmstrip* setting; it is hidden in portrait, where
  the filmstrip always sits below the photo.
- 2026-11-12: iPad feedback, filter: the loupe narrows its snapshot to the pictures the filters
  let through, but keeps the shown picture until it is left, so a decision never shifts the photo
  and the undo toast still shows what was decided.
- 2026-11-12: iPad feedback, swipe hint: while a finger lifts the photo, a pill in the stage's
  middle names the flag the release sets, dashed and fading in with the distance while the release
  would settle back, filled with the flag's colour once it decides. The gesture recogniser reports
  the swipe a release would make on every move, so the hint and the release share one rule (flick
  included); a direction set to Nothing shows no hint.
- 2026-11-12: iPad feedback, filmstrip pin: the pin toggle moved from the title row to the
  filmstrip's end, a 44 px column of the same dark band, so it reads as part of the strip; still
  landscape only.
- 2026-11-12: iPad feedback, Unflag: its pressed state (every unflagged picture) was a 2 px outline
  in the text colour over the 1 px border, which read as a thicker white border. It is now filled
  like *Pick* and *Reject*, in a neutral grey (`--honeycomb-unflag-fill`, 7.2:1 with white).
- 2026-11-12: Series compare also compares the images (owner decision): a dHash of the 256 px grid
  preview, alike at most 10 of 64 bits apart, 30 s window with hashes, the 3 s rule without one;
  constants, not a setting, until the owner's taste asks for one (ADR 0021).
- 2026-11-12: The mockup selects several pictures with a visible *Select* button (long-press on
  touch is a shortcut) and filters the grid by tags with the same autocomplete entry (`F`): a
  picture stays if it has every chosen tag.
- 2026-11-12: Tags (`docs/dev/07-tags.md`, D1–D9, owner approved the #109 mockup): sidecars only
  with the embedded XMP read-only; union of sources; tile icon and count; the filter is AND (the
  mockup shows only pictures with every chosen tag, deviating from the recommended OR); a parent
  matches its descendants; tag list kept per user; no tag management in v1; Select button plus
  long-press; foreign `dc:subject` keywords kept.
- 2026-11-13: Tags in sidecars (XMP-004): a separator a field cannot hold inside a name (`|` in
  `TagsList`, `/` and `|` in `dc:subject`) is read as `\`, like digiKam's `/` in
  `hierarchicalSubject`, so no tag is dropped and lost on the next write; empty names are dropped;
  tags are sorted by code unit so the written list is stable; step 1 (ADR for the tag table) moves
  to the backend step, because the sidecar module needs no table.
- 2026-11-13: Tag storage (ADR 0022): tags get their own table beside the decisions, one JSON row
  per file, so no decision save can erase them; the tag list has no unique index and is compared
  in PHP, because MySQL's default collation would merge `Anna` and `anna`; a tag is at most 255
  characters and a file has at most 100 tags. The *Tags 1* item is cut in two: storage and
  endpoints now, the embedded XMP and the write-through to the sidecars next.
- 2026-11-13: Release versions: honeycomb is not ready for 1.0, so release-please starts at 0.1.0
  (`initial-version`, it defaults to 1.0.0) and `feat` bumps the minor, `fix` the patch while
  below 1.0 (`bump-patch-for-minor-pre-major` removed).
- 2026-11-13: Tags in the cull (TAGS-002): *Tags 1* is cut again; the sidecar take-over and the
  write-through come now, reading the JPEG's embedded XMP (D1) moves to *Tags 1b* because it needs
  a new endpoint and its ADR. A picture takes the sidecars' tags over only when the sidecars are
  looked up for its decision anyway (no stored decision) and no member has stored tags, so opening
  a cull makes no extra request. A tag write changes only the three tag fields, never the decision,
  so a pending decision take-over cannot be overwritten, and it creates a sidecar only while tags
  are left. Sidecar tags over the storage limits are left out with a warning instead of failing
  the whole save.
- 2026-11-13: Embedded XMP (*Tags 1b*, ADR 0023): the server finds the JPEG's packet and sends
  only it, since sending the whole JPEG costs megabytes per photo. The embedded XMP counts as a tag
  source only while the JPEG has no sidecar of its own (`IMG.JPG.xmp` or the shared `IMG.xmp`),
  digiKam's own rule: honeycomb never writes the JPEG, so a plain union would bring a removed
  embedded tag back with every later write. For the same reason a write creates the JPEG's sidecar
  also when the last tag goes and the embedded XMP held tags, and a picture whose embedded XMP
  cannot be read takes no tags over and is not written through, so its tags are not lost.
- 2026-11-13: Tag entry (TAGS-003): `T` in the grid without selection mode opens the entry for the
  focused photo, as the decision, delete and move keys act on it.
- 2026-11-13: Tag entry: the levels of each tag (`Places` of `Places/Italy`) are derived in the
  browser from the tag list and the cull's tags; the server's tag list stays as stored.
- 2026-11-13: Tag entry: bulk tagging of the selection and the dashed partial chips come with the
  entry, since the entry has to show the targets' tags anyway; *Tags 3* keeps only long-press.
- 2026-11-13: Tag entry: a *Done* button closes it by touch, and below 600 px it is a bottom sheet;
  it floats over the loupe and the series viewer like the toast.
- 2026-11-13: Tag entry: a tag change is one undo step in the same history as the decisions, over
  the pictures it altered; undo applies the inverse change to them rather than restoring stored
  rows, so tags another step changed meanwhile stay.
- 2026-11-13: Tag entry: a failed tag save, also of an undo or redo, sets the grid's existing
  "could not save" notice like a decision; the toast that already said *Undid* is not withdrawn.
- 2026-11-13: Tag filter: `F` stays fullscreen, so the tag filter is the filter bar's *Tags* group
  (opened with `\`) rather than its own key.
- 2026-11-13: Tag filter: its entry picks known tags only and says *Pick a known tag* for other
  text, since an unknown tag could only empty the grid; the filter badge counts each chosen tag.
- 2026-11-13: *Tags 3* (multi-select) was already delivered: the *Select* icon button (labelled
  from 1000 px, per the toolbar decision in `docs/dev/plan.md`), long-press and the *Tags* action.
- 2026-11-13: Tags in the loupe's info panel are left for a follow-up PR to keep TAGS-004 small.
- 2026-11-13: The info panel's *Tags* section shows each tag by its full path, one per line;
  *Written to* names the write-through's own targets (`sidecarTargets`, incl. sidecars it creates),
  so the panel and the write cannot disagree; a shared folder reads *Not written, shared folder*.
- 2026-11-13: The tag entry lives in `docs/dev/mockup/index.html` now; `tag-entry.html` and its
  Vitest harness `tests/js/mockup-tag-entry.test.ts` are removed, since the built app's tests
  (`App.tags`, `TagEntry`, e2e `tags.spec.ts`) prove the same behaviour. The merged mockup follows
  the built app: a *Tags* group in the filter bar with *Add tag* (no `F`, which is fullscreen
  there), *Tags* beside *Move…* in the action bar, a tag badge on tiles, tags in the info panel.
- 2026-11-13: UX M1 slims the grid toolbar by window width (media queries), not by a measured
  toolbar width: the ⋯ menu is a popover outside the toolbar, so a container query cannot reach
  it. Below 600 px the flag chips show icons only, which the two-row limit on a phone needs.
  *Delete rejects* in the review is the toolbar's *Review rejects*. Selection mode keeps its own
  row on top of the two. The mockup keeps its layout.
- 2026-11-13: UX M2 names the scope whenever any filter hides photos of the cull (the default flag
  filter hiding rejects included), not only the flag filter: the filter bar narrows the same
  count, and the contradiction with the recent folder set's progress is the same. The mockup keeps
  its wording.
- 2026-11-13: UX M3 hides the badge of a complete pair only while it is not marked *Keep RAW*:
  the badge was the tile's only *Keep RAW* mark (`JPG+NEF ✓`, GRID-001.6), and a kept pair is an
  exception worth showing like a single. The tile's accessible name still says `JPG+NEF`, so a
  screen reader keeps the pairing it cannot see from a missing badge. The mockup hides it too.
- 2026-11-13: UX M4 closes the resume toast on a scroll of the user only: the grid's own scrolls
  (back to the top on opening a folder set, keeping the focused tile in view) leave it, or opening
  a folder set would close its own offer. A decision needs no extra rule: its *Undo* toast
  replaces the offer. *Resume* in the More menu stays (DECISIONS-002.14).
- 2026-11-13: UX M5 makes *Skip* secondary too, as in the mockup, so the active card's *Pick this,
  reject the rest* is the dialog's only primary button. The one line of instructions drops "Photos
  taken within 3 seconds of each other": since ADR 0021 a series also spans up to 30 seconds of
  alike shots, so the sentence was no longer true. The keys stay in the tooltips and the shortcut
  sheet.
- 2026-11-13: UX M5 also widens the series compare dialog to 1400 px (at most 90 % of the window)
  and caps each photo at a 2:3 portrait photo's height at the card's width:
  in the 900 px large dialog four landscape photos stay 200 px wide however tall the cards grow,
  so filling the height alone left tall empty cards around landscape photos.
- 2026-11-13: UX M6 removes the info panel's *Preloading* section without a replacement: the
  loupe budget e2e now counts the finished loupe-tier requests instead of reading the counter,
  so production keeps no debug output. The *Sidecars* row lists file names, which are unique
  in a folder, so "each once" needs no extra deduplication; "—" replaces every *none*.
- 2026-11-13: UX M7 closes the ⋯ menu on every action, not only on those that open a dialog:
  *Resume*, *Review rejects* and *Compare series* open the loupe or a view, and a menu left
  above them hides it the same way. View options keep it open so several can be set in a row.
  One separator splits view options from actions, as the review asks; the mockup's further
  separators between action groups stay out, since the app's menu holds fewer items.
- 2026-11-13: UX M9 renames the accent from "honey" to "primary" in the glossary and `plan.md`
  only. The mockup keeps its `--honey` tokens: it is frozen (ADR 0003) and has no Nextcloud
  theme to read the primary colour from, so `plan.md` says its honey stands for that colour.
  Older entries in this file and `ux-review.md` stay as written, since they record the past.
- 2026-11-13: UX M8 reads "two-column list" as the five keys in two columns, each key cap beside
  its action, so the list takes three rows; it picks the order by the primary pointer
  (`(pointer: fine)`) once when the guide opens, and gives both lists a heading, *Keys* and
  *Gestures*, since a guide that starts with keys needs to say where the gestures begin. The
  sections swap in the DOM, not by CSS `order`, so a screen reader reads them as shown.
- 2026-11-13: UX L1 makes the shortcut sheet one `<table>` with a `<tbody>` per group, each
  headed by a `<th scope="rowgroup">` row, rather than a CSS grid over separate tables: one
  table aligns the key column natively and keeps the row-group semantics for screen readers.
  The group names are no longer `<h3>` headings, as a heading inside a table cell is invalid.
  The frozen mockup (ADR 0003) keeps its separate tables.
- 2026-11-13: UX L2 mutes the whole status line of the folder picker, the count included, not
  only the hint: the count is repeated on the *Cull* button, so the line is secondary. The folder
  rows lose their vertical padding and the arrow loses Nextcloud's global button margin, so a
  row stays at the clickable size (34 px, 44 px for touch); a row with a reason line under the
  name may still be taller.
- 2026-11-13: UX L3 keeps the navigation's open state in the browser (`localStorage`), like the
  tile size: it depends on the screen, not the user. Only a toggle while the navigation sits
  beside the page (from 1024 px on) is a choice; below 1024 px Nextcloud overlays and closes it
  itself, so nothing is applied or remembered there. A remembered choice applies at every width
  from 1024 px on.
- 2026-11-13: UX L3 also fixes `APP_SEAMS.storage`, which wrapped `window.localStorage` in one
  function too many: Vue takes the default of a function-typed prop as the value, so every
  browser-storage read and write failed silently and the tile size, the info panel's width and
  the loupe's navigation toggle never lasted past a reload. The new choice depends on it.
- 2026-11-13: UX L4 reads "the *File types* heading sits 8 px left" as the section's text (hint,
  *RAW extensions*), since every section heading is the same `NcAppSettingsSection` heading. Every
  text line in every settings section now takes Nextcloud's section text offset, so it starts
  where its heading's text does; boxed controls (chips, fields, preview) keep the content edge.
- 2026-11-13: UX L6 asks for two action bar rows on a phone, but with 44 px targets rating (six
  buttons, 292 px), colour label and *Keep RAW* need about 490 px, more than a 410 px phone has.
  The bar puts the flags, *Move* and *Delete* first wherever it wraps (two rows on a tablet);
  on a phone in portrait the decisions take two rows below them instead of shrinking targets.
- 2026-11-13: UX L7 asks the loupe filmstrip to start at its left edge until the shown photo
  reaches the middle. The strip stops at its right edge the same way, so the last photos never
  leave the right half empty either; that is how Lightroom's filmstrip behaves (LOUPE-001.19).
- 2026-11-13: Series in the loupe (concept, awaiting the owner's sign-off): a "⧉ 2/5" chip in the
  title row and `N` open the existing series compare on this one series, *Pick this, reject the
  rest* (`Shift+K`) joins the loupe's rating row, and the filmstrip frames each series. A gesture
  was rejected as undiscoverable and an inline series strip as a second compare view
  (`docs/dev/plans/loupe-series-concept.md`).
- 2026-11-13: The owner wants to see a whole group together, so a run is one series however long
  (the 2026-11-10 split into fours is dropped). The compare keeps its cards side by side, at
  least 180 px each (half the width on a phone), and scrolls the row sideways with the active
  card scrolled into view; a wrapped grid or smaller cards would lose the level flag buttons
  or make the photos too small to judge (SERIES-001.4, .21).
- 2026-11-13: Series parts 1–3 (UX lead, concept awaiting sign-off): #147's one-series-per-burst
  stays, but a series ends 60 s after its first shot, since photo-to-photo linking can chain
  minutes of a quiet subject, and the series viewer preloads a neighbour window, not the whole
  series. A plain *Pick* never rejects the rest silently; its undo toast offers *Reject the other
  N* instead (`docs/dev/plans/loupe-series-concept.md`).
- 2026-11-13: Owner decisions on the series-in-the-loupe concept: *Pick this, reject the rest*
  (loupe button, `Shift+K`, the compare opened from the loupe, the toast's *Reject the other N*)
  lands the loupe on the first photo after the series, since the series is decided; the compare
  uses the whole screen as a grid of the series' photos instead of a sideways strip, from the
  loupe and from the grid toolbar alike, so a burst is seen whole
  (`docs/dev/plans/loupe-series-concept.md`).
- 2026-11-13: Owner decision, revising UX review L5 (#143): the flag buttons run *Pick* left,
  *Unflag* in the middle, *Reject* right on every device; in landscape *Unflag* floats at the
  bottom centre above the filmstrip. As UX lead I extend the order to every flag button group
  (series viewer, compare cards, grid action bar), replacing the 2026-11-12 line that the small
  buttons keep *Pick*, *Reject*, *Unflag*, so a hand learns one order.
- 2026-11-14: Owner point on the series-in-the-loupe concept: one photo of the compare grid goes
  full screen. As UX lead: the full screen is the existing series viewer, opened by a *View full
  screen* button shown on every card, a double tap (double click) on a card or `Enter`; a single
  tap only makes a card active, since a tap that opens a full screen view without a sign is what
  hid the viewer; *Back to the series* or `Esc` returns to the grid
  (`docs/dev/plans/loupe-series-concept.md`).
- 2026-11-14: Owner point: the loupe's filmstrip does not show the shown photo; its 2 px white
  line vanishes on bright photos. As UX lead: a 3 px white ring with a 1 px black inner edge, the
  current thumbnail never dimmed, so it reads on any photo, inside a honey series frame and next
  to rejected thumbnails; it ships as its own first build PR (`docs/dev/plans/loupe-series-concept.md`).
- 2026-11-14: The filmstrip's flag mark moves from 2 px to 4 px off the thumbnail's corner, so it
  sits inside the current photo's 4 px ring instead of on it (series step 1, LOUPE-001.19).
- 2026-11-14: The 60 second series span is measured from the series' first picture after rejected
  pictures are left out, like the gaps, so rejecting a series' first picture moves its end; no new
  hotkey, since the step adds no action (series step 2, SERIES-001.22).
- 2026-11-14: The series viewer keeps only the shown photo's full image, as the loupe does, not every
  photo's, so synchronised zoom loads each 100 % image on its page; no new hotkey, since the step
  adds no action (series step 3, SERIES-002.1).
- 2026-11-14: Series step 4 moves *Unflag* off the right edge to the bottom centre, lifted by the
  action row and the open filmstrip, so the phone-landscape TODO "keep *Unflag* clear of the
  filmstrip" is closed by it; no new hotkey, `P`, `U`, `X` stay and the tooltips follow the new
  order (GRID-003.15, LOUPE-002.11).
- 2026-11-14: The flaky e2e from #147 ("whole burst") came from the compare dialog's focus trap: it
  activates after the open transition and focuses card 1, which scrolls the row back. The compare
  now focuses the active card's photo on open without scrolling, so the trap keeps it; scroll snap
  stays, it was not the cause (30 of 30 runs pass, 3 of 30 failed before; SERIES-001.21).
- 2026-11-14: The full-screen series compare (concept step 5) puts *Skip* in the bottom bar beside
  *Pick this, reject the rest*, not in the title row as the mockup draws it: NcDialog's header
  holds only the title and the close button, and the bar keeps both series actions within thumb
  reach. The cards keep their stars and flag mark next to the name, so a rating key shows its
  effect on the card. "Phone" for the grid's 150 px minimum means the screen's shorter side is at
  most 520 px, so a phone held sideways counts too (SERIES-001.21).
- 2026-11-14: Full screen from the compare (concept step 6): `Enter` is handled by the focused card's
  photo, as the grid's tiles handle it, rather than added to the window key map, where it would
  take `Enter` from every focused button; focus follows the active card while it is on a card's
  photo, so `Enter` opens the active one. The card double tap and the loupe share one pure rule
  (`src/logic/double-tap.ts`, 320 ms, 40 px, same card). The viewer's back arrow is a new shared
  `BackButton` with the word hidden on a phone, since the loupe has no back arrow yet to reuse.
- 2026-11-14: The filmstrip's series frame (LOUPE-001.19, concept step 7) ships now and its "⧉ N"
  tab ships hidden: the tab renders only while the loupe listens for `compareSeries`, which step 8
  adds with the chip and `N`, so no control opens nothing. The frame counts every series that is
  not rejected, picked ones included, like the chip (`allSeries`), unlike *Compare series*, and a
  run of one photo split off by the sort or a filter is framed too, since it still belongs to a
  series. The frame is drawn over the photos' edges rather than padding them, so the strip's
  geometry and centring stay as they are; the shown photo's ring moves 2 px inside it.
- 2026-11-14: The loupe's series chip (LOUPE-001.25, concept step 8) drops the word "Series" at
  520 px on either side, the phone rule of SERIES-001.21, so a phone held sideways keeps the short
  "⧉ 2/5". The compare opened from the loupe holds that one series, decided or not, and closes
  without moving the loupe once fewer than two of its photos are not rejected. A frame's "⧉ N" tab
  makes the shown photo active when it is in that series, else the frame's first photo. The
  compare and its viewer mount inside the loupe (`.photo-loupe`), since the loupe sits above the
  page's dialogs; the viewer's title stays "Series 1 of 1" from the loupe, unchanged.
- 2026-11-14: *Pick this, reject the rest* in the loupe (LOUPE-002.15, concept step 9) reuses the
  compare's pick-and-land step (`pickRestAndLand` in `src/series-compare.ts`), so the loupe, the
  compare and its viewer land after the series by one rule; the shortcut sheet's `Shift+K` row reads
  "Series: pick this, reject the rest", since the key now works in the loupe as well.
- 2026-11-14: *Reject the other N* in the undo toast (LOUPE-002.16, SERIES-002.11, concept step 10)
  does exactly what *Pick this, reject the rest* does, so N counts every other photo of the series
  that is not rejected (a second picked one included) and the label says what the tap does; it is
  offered while one of them is unflagged, after a *Pick* in the loupe and the series viewer only
  (the grid and the compare's cards have their own *Pick this, reject the rest* or none). Its key
  is that action's `Shift+K`, named in its tooltip, rather than a new key that would mean the same
  thing; the toast carries it as an optional offer before *Undo*.
- 2026-11-14: The first-series hint (LOUPE-001.26, concept step 11) is a third view-state key,
  `seriesHintSeen`, beside the gesture guide's (LOUPE-003): it waits for the gesture guide so two
  cards never stack, hides at a photo outside any series without counting as seen, and goes for
  good by *Got it*, `Esc` (then not closing the loupe, as the mockup does) or by using what it
  tells: the chip, `N`, the frame's tab or *Pick this, reject the rest*. It adds no key of its
  own; `Esc` dismisses as it closes every other card. It does not take the focus, so paging with
  the keys goes on, and it wakes the faded title row and keeps it while it shows. Unlike the gesture
  guide it has no *Show again* in the settings: the concept asks for none, and the user guide
  explains the chip.
- 2026-11-14: The subfolder listing walks the folder tree, one `getDirectoryListing()` per
  folder, instead of paging a file-cache search by offset (ADR 0009 amendment). Keyset paging by
  `fileid >` is not possible: Nextcloud 35.0.2's `SearchBuilder::validateComparison` allows only
  `eq` and `in` on `fileid`. The walk reads each row once with memory bounded to one folder; one
  unpaged search with a limit of 60,001 would hold that many nodes at once. The `TODO.md` item on
  `LIKE` and upper-case names on PostgreSQL goes with the search, as names now match in PHP.
- 2026-11-14: The undo toast's buttons show the pointer by an underline and the focus by an
  outline in their light text colour, both on the transparent background: the mockup gives
  them no hover look, and a filled hover would need a colour Nextcloud does not offer for the
  inverted toast (LOUPE-002.17).
- 2026-11-14: Saving decisions and tags inserts their rows with one multi-row `INSERT` per 1,000
  rows, built as plain SQL because Nextcloud's query builder inserts one row; Oracle before 23ai
  has no multi-row `VALUES`, so it keeps one row per statement rather than a second dialect.
- 2026-11-14: `occ app:remove honeycomb` keeps the tables and settings on Nextcloud 35 and the
  docs say how to delete them by hand; honeycomb gets no uninstall step that deletes user data,
  which would need an ADR and the owner's decision. The admin docs now say the `migrations:`
  commands need debug mode, because Nextcloud 35 only registers them there.
- 2026-11-14: The warmed-preview keys live in the browser's local storage, not on the server: a
  server table would be a new ADR-level storage choice, and a wrong "warmed" costs only one
  synchronous render. They are capped at 20,000 (`PICTURE_CAP`), about 400 KB, the files warmed or
  skipped last; a cancelled warm-up logs nothing, a failed one logs as before.
- 2026-11-14: The folder picker learns `hasSubfolders` from a folder-only listing of each child
  (`getDirectoryListing(FileInfo::MIMETYPE_FOLDER)`), so the file cache returns folders only
  instead of every photo in the child; a child that vanishes or may not be listed still counts as
  having none.
- 2026-11-14: Decision and tag saves of a tab go one at a time through `src/logic/save-queue.ts`,
  rows given meanwhile merged by file id with the newest winning, as the resume position already
  does; a failed save is answered only once the queue is idle, newest first, without the files a
  later save stored, so putting each back in turn ends at what the server holds.
- 2026-11-14: Sidecar writes run in passes: the steps that come while a pass runs are written
  together by the next one (`src/logic/sidecar-pass.ts`), each picture with its latest decision,
  its tag changes combined in order and the union of its paths, so a retry limited to one sidecar
  may also save its siblings, where the next rule makes that harmless. A sidecar whose merged bytes
  equal its own bytes re-serialized at the same time is not saved and counts as written, which
  spares a file version, an ETag chain and a sync download per unchanged sidecar.
- 2026-11-14: A folder on an incoming share (mount type `shared`, a user or a federated share) is
  shared without asking the share manager: its owner is always another user, so the access-list
  query per listed folder was wasted. Outgoing shares are still asked per folder.
- 2026-11-14: Stored visual hashes (ADR 0024) reach the browser as a `visualHash` field of each
  listing entry, not through a lookup endpoint: no extra request, and the server drops a hash
  whose etag is no longer the file's. The etag alone marks the version; no mtime column.
- 2026-11-14: The browser no longer keeps visual hashes in its storage, not even as a cache: the
  listing delivers them, and the old key `honeycomb.visualHashes` is removed once.
- 2026-11-14: A visual hash save looks up each file id in the user's folder, so a hash is stored
  only for a photo the user reaches and only for its current etag; batches of 100 keep it short.
  The save goes straight to the API, not through the decision save queue: hashes are computed one
  at a time and a batch is sent after the previous one, so no two saves of one tab overlap.
- 2026-11-14: A missing `honeycomb_hashes` table fails the listing loudly instead of delivering no
  hashes; only a Git-checkout install can lack it, and docs/user/admin/updating.md tells how to
  add it.
- 2026-11-14: The similarity indicator sits in the grid toolbar beside the decided count and
  reuses its look (count text and the same 80 px bar, now the shared `ProgressBar`, stacked under
  the decided bar so it takes no width), in quiet text, warning colour on failures, gone when
  done; below 900 px only the bar and a short *⚠ 3*, so a phone keeps its two toolbar rows. It
  fits the signed-off toolbar, so no owner-decision issue. It counts only the hashable pictures
  (a shot of the same camera within 30 s), since the others need no hash.
- 2026-11-14: No per-tile hash mark: the owner called it optional, a mark on every tile would add
  noise to the grid for a rare failure, and the toolbar already names how many failed. The state
  per picture (`stateOf`) is there for one later.
- 2026-11-14: A failed hash is remembered per file version for the visit and not tried again; the
  next page load tries it once more. No failure is stored on the server: a missing preview may
  be rendered later, and a new table or column for it is not worth an ADR.
- 2026-11-14: *Similarity: not saved* reflects the last save only; a later successful save clears
  it. The unsaved hashes still count for the visit and are computed again on the next one.
- 2026-11-14: The similarity page hashes every photo below the folder, a pair's RAW too: the
  server knows no pairing, which is a browser setting (ADR 0025).
- 2026-11-14: No `needs-owner` issue for the similarity page: it reuses FolderList, ProgressBar,
  NcButton and NcNoteCard on a plain page and fits the existing design.
- 2026-11-14: The similarity page is a page of its own (`/similarity`, own Vite entry), not a view
  in the cull: the cull's shell is at its size limit and its bundle stays as it is.
- 2026-11-14: A similarity run looks at 500 photos per page, saves in batches of 250 and uses the
  cores less one as workers, at most eight; a failed photo is tried once per run.
- 2026-11-14: Pausing a similarity run waits for the hashes and the save in flight, not for a page
  load, which is queued when it arrives.
- 2026-11-14: With two Vite entries each chunk injects its own CSS (`relativeCSSInjection`) and the
  hash worker is built into `js/`, so the cull keeps its styles and REUSE sees no stray assets.
- 2026-11-14: The clean-up job reads at most 100 chunks of 1,000 rows per table and run, so a cron
  run stays short; a table of more than 100,000 rows takes several days per pass, and a leftover
  row of a deleted file costs nothing but space. The cursor is a lazy app config value per table.
- 2026-11-14: A database error in one table of the clean-up job is logged and the other tables are
  still cleaned; the row id of the last finished chunk is kept, so the next run goes on from there.
- 2026-11-14: The visual hash save is limited to 300 requests a minute per user, three times what
  the similarity page sends at most on a strong computer (ADR 0026).
- 2026-11-14: Nextcloud's `429` has no `Retry-After`; the similarity page waits the header's
  seconds when a proxy sets one, else 60 s, the limit's period, and ignores the HTTP-date form,
  which would need the clock.
- 2026-11-14: A limited save of the similarity page waits and is sent again without pausing the
  run; the cull treats it as a failed save, since it saves far too seldom to reach the limit.
- 2026-11-14: The picker's *Recent* is its own component (`PickerRecentSets`) and the navigation
  keeps `RecentFolderSets`, since #180 variant C only concerns the dialog; *Show all* folds back
  as *Show fewer* so the focus stays on the button; rows shrink by 8 px below 640 px of height.
- 2026-11-14: Stored series (#185 PR 0): a series write moves the listed files into the series
  and leaves unlisted members alone, and an unknown series id makes a new series, so members in
  another folder set survive a merge and undo works after the clean-up job (ADR 0027).
- 2026-11-14: The series lookup answers per series only the requested members and `elsewhere`,
  not a count: the server cannot pair files into photos; the compare says "Also in other
  folders".
- 2026-11-14: *Series done* is a toggle in the compare's title menu (pressed again reopens), the
  badge of a done series carries a check instead of the pin, and the series edits get no keys yet.
- 2026-11-14: SERIES-005 is `accepted`, not `draft`: the owner decided D1a–D5a and #183 and
  released the chain, so the backend PR can mark its tests.
- 2026-11-14: The similarity strip (#181 B) replaces the toolbar's similarity text at every width,
  not only its thin bar: one place to look, and the narrow toolbar keeps its room.
- 2026-11-14: The strip's failure texts stay *Similarity: 3 photos not compared* and *Similarity:
  not saved*; it has no retry, as a failed hash is retried on the next visit (SERIES-003.17).
- 2026-11-14: A series badge is dashed (#181 C) while a member of that series is pending; a pending
  picture outside the series that may still join it does not mark it, to keep the rule simple.
- 2026-11-14: The strip lies over the grid's sticky folder header while it shows; it lets taps
  through to the tiles.
- 2026-11-14: The grid keeps the strip's 22 px free above its first row at all times (#181 B), so
  the strip covers no tile at the top and nothing moves when it comes or goes.
- 2026-11-14: `FileIds` throws the caller's exception class, a subclass of the new
  `InvalidRequestException`, so each controller keeps mapping its own exception to 400 and no
  service needs a try/catch to rethrow (R5a).
- 2026-11-14: A series is a value `Series{key, members}` keyed by the smallest member file ID of
  its first picture: unique, since a picture belongs to one series, and stable while that
  picture stays, until the stored series of #185 may bring their own ID (R1a).
- 2026-11-14: The series compare follows its shown series by key and falls back to its last place
  once the key is gone (decided, or re-keyed by a rejected first picture); the anchor of the
  active picture and the rest offer keep testing picture membership, since a series opened from
  the loupe is a snapshot whose key a rejected first picture outdates (R1b).
- 2026-11-14: The grid's series badge, the open-series set and the loupe's landing after a series
  take the keyed series, and the array adapter of R1a is gone; tile, title row and toolbar keep
  taking the numbers derived from it (size, place, count), since they show a series, not name it
  (R1c).
- 2026-11-14: `saveQueue` takes the key that merges its rows (`byFileId` for decisions and tags)
  and, given a `wait`, sends a save the server limits (`429`) again after the seconds it asks for,
  with the same rows; rows given meanwhile wait for the next save. Series states can then be saved
  through it instead of a seventh write path (architecture review R7a).
- 2026-11-14: The mapper SQL is tested against SQLite inside the pinned Nextcloud image
  (`tests/php-db/`, `scripts/php-db-tests.sh`, CI job `php-db`), not with a hand-built query
  builder over Doctrine: no new dependency, and the real `IQueryBuilder` runs (R10, #185 PR 1).
- 2026-11-14: A series write that names one series id twice is a `400`, like a file id twice; a
  member row whose series row the sweep removed meanwhile reads as `open`; the empty-series
  sweep keeps its cursor under `empty_series_after` and shares the cursor walk of the vanished
  file sweep (#185 PR 1).
- 2026-11-14: A picture whose members have different series rows is in the series of its first
  member with one (RAW first), else kept out when a member is; stored members without a capture
  time sort last, by name; a stored series never shows "may still change" while hashes are
  pending; its members are still hashed for the similarity page (#185 PR 2).
- 2026-11-14: The series lookup lives in `src/series-api.ts`, because `api.ts` is at the
  300-line limit; it shares `API` and `isRecord` with `api.ts` (#185 PR 2).
- 2026-11-15: The grid screen reads the cull from a context App provides (ADR 0028, review R8a):
  one `CullContext` holding the cull and the selection whole and each flow as a `Pick` of what a
  screen uses, so a test fakes a flow in a line; the toolbar's 22 props become the groups
  `folders`, `view`, `progress`, `selection` and `tasks`; its events stay as they were.
- 2026-11-15: Writing decisions to XMP sidecars is opt-in (XMP-003, risk review R1/R9): a
  setting *Off* (default for every user, no migration) / *Only existing sidecars* / *Existing and
  new sidecars*. The opt-in dialog opens when the user leaves *Off* in the settings, not as a
  prompt at start. Take-over reading runs with every choice; the ⋯ menu write in a shared folder
  works with every choice and creates no sidecar under *Only existing sidecars*, nor does a retry
  or the embedded-JPEG tag sidecar.
- 2026-11-15: An existing XMP sidecar is overwritten only while `files_versions` is enabled for
  the user, otherwise the save answers `noVersions` (XMP-002.10, risk review R2, ADR 0017
  amendment). Chosen over a one-time `.xmp.orig` copy, which would add synced files other
  programs may read and keep only the first version. The check is per user, like the trash bin
  check; a storage that keeps no versions despite the app is not detected.
- 2026-11-15: Move and trash requests go in chunks of at most 50 whole pictures and 500 files;
  the endpoints refuse more than 500 files (ADR 0029, risk review R4, R15). Chosen over a server
  job queue or a move journal, both a new table. A later failed chunk keeps what earlier ones did
  and lists the unsent files as `failed`, so *Retry failed files* and *Undo* cover them; the
  progress shows as "N of M photos sent" in the dialog's footer.
- 2026-11-15: A file the trash bin would not keep (storage without the trash bin wrapper, or at
  least as large as `trashbin_size`, outside a Team folder) is refused as `noTrashBin` before its
  picture is touched (ADR 0030, DELETE-001.9, risk review R6). Chosen over checking after the
  delete (too late) or the trash manager (no public API). Team folders and local External
  Storage are proven in e2e with a pinned Team folders 23.0.1 release; the summaries' note now
  names retention and space and advises a backup.
- 2026-11-15: Decision and tag saves skip file ids the user does not reach as a photo instead of
  refusing the save, as the series and visual hash saves do, so one vanished file never fails the
  rest; every write route is limited to 600 requests a minute per user, one shared limit far above
  a person culling, the visual hash save keeps 300 (ADR 0031, risk review R10). Preview warming is
  not limited: it reads and renders cached previews, 16 file ids a request.
- 2026-11-15: The supported Nextcloud range stays 35 only (`min-version` = `max-version` = 35,
  the owner's Q1 answer); 36 is not released, so there is nothing to test it on. e2e runs on
  35.0.0, the first release `min-version` admits, and on the newest 35 release it passes on
  instead of every patch release, and `scripts/nextcloud-versions.sh` ties both to `info.xml`. The
  update test starts from v0.1.0, the first release, so it runs every migration added since, and
  saves through that release's own API instead of writing rows, so it checks what a real user had
  stored (R14).
  The newest image stays 35.0.2: on 35.0.3 a `.part` node has no cache entry and permissions 0,
  so moving the sidecar part file into place fails; the fix revises ADR 0017 and is its own
  TODO.md item instead of growing this change.
- 2026-11-15: The App Store package is built by `scripts/package.sh`, not krankerl or a Makefile:
  the repository's tooling is shell scripts under `scripts/` with table tests, krankerl is one
  more pinned binary for CI, and an allowlist of app folders keeps tests, sources and `vendor/`
  out of the tarball. Code signing runs `occ integrity:sign-app` in the pinned Nextcloud image
  (`scripts/sign-app.sh`), so it needs only Docker, the key and the certificate.
- 2026-11-15: The release job signs and uploads to the App Store only when the secrets
  `APP_SIGNING_KEY`, `APP_SIGNING_CERT` and `APPSTORE_TOKEN` exist; without them it attaches an
  unsigned tarball to the GitHub release, so releases keep working until the owner has the
  certificate (R16).
- 2026-11-15: The App Store screenshots point at the synthetic-photo screenshots of
  `docs/dev/ux-review-2026-11.md` in `polandy/honeycomb-assets` (`ux-review-2026-11/`, kept for the
  review): grid, loupe and series compare on the iPad. Fresh screenshots replace them in
  `appinfo/info.xml` when the UI changes enough to mislead.
- 2026-11-15: The preview warm-up parses its file ids in `ImageService::warm()` through
  `FileIds` and throws the new `InvalidPreviewRequestException`, like every other list of file
  ids; the move, trash and sidecar exceptions now extend `InvalidRequestException` so `FileIds`
  can throw them (R5b of the architecture review).
- 2026-11-15: Every controller action answers through `ApiResponse::forUser`, which answers
  401 without a user and maps the service exceptions to their status by one table (R9 of the
  architecture review). The cursor, position, settings and view-state exceptions now extend
  `InvalidRequestException` too. The status codes are unchanged; the few routes that answered
  an error with an empty body now answer `[]` like all the others.
- 2026-11-15: A move that would leave its storage (out of or into an incoming share, a group
  folder or external storage) is refused with the new result `otherStorage`, and the move summary
  lists such pictures as not moved (MOVE-002.11, MOVE-004.16, risk review R3, ADR 0018
  amendment). Chosen over allowing it after a confirmation, since the owner who loses the files is
  not the one who confirms; there is no setting to allow it.
- 2026-11-15: ADR 0032 supersedes ADR 0005 and 0012 and amends 0017, 0022 and 0023, rather than
  superseding all five, since the sidecar endpoints, the tag list and the embedded XMP endpoint
  stay.
- 2026-11-15: honeycomb does not keep digiKam's extra copies (`MicrosoftPhoto:Rating`,
  `acdsee:rating`, `photoshop:Urgency`) in step (ADR 0032, review F20): digiKam reads `xmp:Rating`,
  `ColorLabel` and `TagsList` first, so a stale copy is not seen, and fewer written fields mean
  fewer foreign bytes changed.
- 2026-11-15: The XMP cache is per user, not shared per file id and ETag (ADR 0032, review F21):
  the pattern of ADR 0012 and the simpler access rule; the shared cache stays an option.
- 2026-11-15: *Remove RAWs* skips, with a hint, a pair whose JPEG sidecar cannot be written before
  the RAW's sidecar goes (ADR 0032, review F22), rather than warning and going on: a JPEG never
  loses its values, as with the owner's rule for *Delete rejected* (Q3).
- 2026-11-15: *Clear cache* is one `DELETE /api/v1/xmp-cache` that also removes the visual hashes
  (XMP-006), since the owner's decision clears both together and a second endpoint would add
  nothing.
- 2026-11-15: The work of ADR 0032 is one milestone (M8) and one `TODO.md` item listing its pull
  requests in order, like the stored series item.
- 2026-11-15: A sidecar write step carries the decision fields it changed, valued when its pass
  starts (XMP-003.20); a pass joins the fields of its steps, and a retry writes the failed fields
  as they are then.
- 2026-11-15: The explicit *Write decisions to sidecars…* write sends every decision field, so the
  stored decision wins there, as ADR 0032's migration rule asks.
- 2026-11-15: A new sidecar starts from the decision the picture's other sidecars state, newest
  first, else from *undecided*; values only the database holds come over in the migration (PR 5).
- 2026-11-15: The JPEG's new sidecar takes over the embedded decision values (rating, flag, colour
  label, *Keep RAW*), not a copy of the whole embedded packet: Lightroom's embedded history can
  outgrow the sidecar lookup limit, and honeycomb writes only its own fields (ADR 0032 PR 3).
- 2026-11-15: An embedded XMP that is not read is a warning in the take-over, like a sidecar not
  read; in a write it fails the picture, since the JPEG's new sidecar would hide unknown values.
- 2026-11-15: *Clear cache* ships with the cache API (ADR 0032 PR 4), not with the switch in PR 6,
  and asks for no confirmation: it loses nothing that the next folder visit does not read again.
- 2026-11-15: The XMP cache save checks only that the user reaches the file as its kind (a
  sidecar, or a JPEG for embedded XMP), not its ETag; the client compares the ETag on lookup.
- 2026-11-15: A refused XMP cache row carries a reason of 1 to 32 lower-case letters, digits or
  dashes, such as `not-utf-8`; the tags follow the rules of the tag API and are stored as JSON.
- 2026-11-15: Whether a folder keeps versions is asked per node: the owner's `files_versions`, a
  versions backend for the storage, and external storage counts as none; the sidecar save uses
  the same check (XMP-002.10).
- 2026-11-15: The XMP cache lookup is a POST without a rate limit, like the other lookups; the
  save and the clear are rate limited like every write.
- 2026-11-15: The legacy migration needs *Existing and new sidecars*, so every picture gets a
  sidecar; *On* comes with ADR 0032 PR 6 (XMP-007.7).
- 2026-11-15: Acknowledging legacy rows writes no XMP cache row; the cull reads a file without one
  from ADR 0032 PR 6 anyway.
- 2026-11-15: The migration leaves the versions check to the sidecar save (`noVersions`); the
  client does not check versions before writing.
- 2026-11-15: The export of unreachable legacy rows is its own endpoint,
  `GET /api/v1/legacy/export`; *Discard* acknowledges the exported ids, and a retry after a failed
  run does not acknowledge, the next run does.
- 2026-11-15: The legacy notice shows, and its inventory is read, only while writing is set to
  *Existing and new sidecars*, as the inventory looks up every file id with a row.
- 2026-11-15: The migration acknowledges the member ids of the saved pictures in one request,
  sorted, and sends none when no picture was saved.
- 2026-11-15: A step with any picture not writable decides none of its pictures; `off` and
  `shared` ask in one dialog and take the step after *Write to sidecars*, the rest is a toast.
- 2026-11-15: Undo and redo are not gated by writability; the server checks every save.
- 2026-11-15: A folder the listing does not name counts as writable; the server rechecks.
- 2026-11-15: `refused` holds the XMP refusals of this visit only; opening a folder set clears it.
- 2026-11-15: The shared confirmation is keyed by the listed folder's `fileId`, which the listing
  now answers; the settings keep the latest 200.
- 2026-11-15: Whether the Versions app is on for the user reaches the client as the page's
  `data-versions-app`, not as an endpoint.
- 2026-11-15: The hint for a stored *Only existing sidecars* is cleared once the settings section
  showed it.
- 2026-11-15: The cull reading through the XMP cache (XMP-006.7) is split from sidecar PR 6 into
  its own PR.
- 2026-11-15: The loupe reads the cull from the context (ADR 0028, review R8b) through a new
  screen root `LoupeScreen`, not by `PhotoLoupe` injecting it: `PhotoLoupe` keeps its props, so
  its eight test files mount it unchanged, and only the screen root injects, as for the grid.
- 2026-11-15: The series compare and its viewer read the cull from the context (ADR 0028, review
  R8c) through `SeriesCompareFlow`, renamed `SeriesCompareScreen` like the other screen roots; the
  context holds the compare flow whole instead of a `Pick` of nearly all its members.
- 2026-11-15: Review R12 is split in two PRs. a) the pool starts its workers when needed and
  survives a crash, and the similarity page takes it from `browserHashWorkers()`; b) the cull
  hashes in the same pool, its saves wait on a `429` like the run's (ADR 0026), with the tile
  order kept and hashing still behind the tile loads. The cull's `429` belongs to b, as the cull
  page's save path changes only there.
- 2026-11-15: The cull hashes in the worker pool one picture at a time, not as many as the pool
  holds (review R12 b): one hash beside the six tile loads keeps the tiles first without coupling
  the hashing to the grid's load queue; the main thread no longer draws previews. A save the
  server limits waits silently in the cull: the strip shows the hash progress, not the save.
- 2026-11-15: A new series gets a local id below 0 until the series write answers its real id;
  later writes, undo and redo then use the answered id, also when the server replaced a vanished
  one (#185 PR 3).
- 2026-11-15: Removing a photo from an automatic series stores the other shown members as an
  open series, even when only one is left, so nothing regroups behind the user's back (#185 PR 3).
- 2026-11-15: *Dissolve this series* keeps out every member the browser knows of a stored
  series, hidden (rejected) ones too; of an automatic series, the shown members (#185 PR 3).
- 2026-11-15: Opened from the loupe, *Dissolve this series* closes the compare on the active
  photo; *Remove from this series* follows the series that is left (#185 PR 3).
- 2026-11-15: A failed series save is logged and puts the rows back per file, as decisions do;
  no grid notice, and no rate-limit wait, as the series write has no rate limit (#185 PR 3).
- 2026-11-15: The compare's menus are `NcActions` with a caption and second lines; the title
  row's menu sits in a row above the cards, as `NcDialog` has no header slot. It holds only
  *Dissolve this series* until merge and *Series done* come (PR 5, PR 6) (#185 PR 3).
- 2026-11-15: Escape in an open menu of the compare closes only the menu: the dialog takes
  `noClose` while a menu is open, counted per menu and reset when the series changes, as NcModal
  closes on any Escape while it tops the focus trap stack and a menu adds no trap (#185 PR 3).
- 2026-11-15: The grid's *Series…* button sits in the decisions row after *Tags*, not in the
  phone's first row, which GRID-003.14 keeps to the flags, *Move* and *Delete*; the bar's one-row
  threshold rises from 960 px to 1040 px to make room for it. On an iPad mini in portrait it may
  wrap to a row of its own rather than shrink to an icon, so its name stays readable (#185 PR 4).
- 2026-11-15: The *Series…* menu always shows three entries; *Merge* takes *Add*'s place when the
  selection touches two series or more, and an entry that does not fit is disabled with its
  reason, as the mockup shows (#185 PR 4).
- 2026-11-15: A merge from the grid keeps the id of the first stored series it touches, brings
  along that series' members outside the folder set, and is done only when every merged series was
  and no loose photo joined (SERIES-005.9, .16) (#185 PR 4).
- 2026-11-15: When a grid edit takes photos out of an automatic series, its other shown members are
  stored as a series even when only one is left, as the compare's *Remove* does (#185 PR 4).
- 2026-11-15: *Merge with the next* / *previous series* in the compare takes its neighbour among
  every series of the folder set with two shown pictures or more, decided ones too, not only those
  the compare offers, so a burst whose second half is decided can still be joined; opened from the
  loupe, likewise (SERIES-005.8) (#185 PR 5).
- 2026-11-15: The merge entry's second line reads "⧉ 3 · starts 14:03:40" (time of day with
  seconds, in the user's locale) without the mockup's "Series 2", as a decided neighbour has no
  number in the compare (#185 PR 5).
- 2026-11-15: After a merge in the compare, it shows the merged series with the same photo active;
  the merged series keeps the id of the earlier stored series, as a grid merge does (#185 PR 5).
- 2026-11-15: Sidecar writes wait per picture (ADR 0032 PR 7) until the loupe shows another picture
  or closes, a write lands on another picture, or 2 s pass idle; a write of several pictures or of
  none goes at once. The flush before delete and move also awaits the writes already in flight.
- 2026-11-15: The pending marker is a white ring on the grid tile, like the stars, read as "Not
  saved yet"; in the loupe the waiting picture is the shown one, so it needs no marker there.
- 2026-11-15: Sidecar requests are packed in the browser, at most 1000 items and 8 MiB each:
  lookups by the listed file size, saves by the content's length; the server keeps no byte budget.
- 2026-11-15: The resume position and the visual hashes save through `saveQueue`; the resume
  position uses one key, so only the latest position is sent, as before.
- 2026-11-15: The sidecar migration and its retry write at once; they are no step on a picture.
- 2026-11-15: The fresh check before deleting (ADR 0032 PR 8) runs for the reviewed rejects and
  *Remove RAWs* only; an explicit *Delete…* of chosen photos deletes them as chosen.
- 2026-11-15: The fresh check agrees per flag: rejects needs every readable sidecar to say
  rejected and at least one source; Remove RAWs needs none to say *Keep RAW* or rejected and
  passes a pair with no sidecar.
- 2026-11-15: Before a RAW goes, `IMG.JPG.xmp` is written only when the RAW's own sidecars hold a
  decision or tags; a pair whose JPEG sidecar cannot be written is skipped.
- 2026-11-15: A delete by decision trashes the files of the fresh listing, so sidecars written
  since the folder was listed go to the trash bin with their photo.
- 2026-11-15: A skipped photo is listed in the delete report with its reason, stays in the grid
  with its old decision until the folder is reloaded, and is not retried; *Retry* stays off when
  nothing failed. A failed listing or lookup aborts the delete with the generic message.
- 2026-11-15: A reject stored only in the legacy decision table is skipped by the fresh check, as
  no sidecar or embedded XMP says rejected.
- 2026-11-15: *Series done* marks the series from the compare's title row menu only; the loupe's
  auto-advance trigger stays the flag, the pictures it skips are those the cull counts as decided,
  and the *rest* offer still reads flags (#185 PR 6).
- 2026-11-15: *Delete…* sends each sidecar with the ETag of honeycomb's last save, followed from
  the listed ETag through each save, and adds the sidecars honeycomb created for a member; a
  sidecar another program changed before honeycomb's save keeps the listed ETag, so it still
  holds its picture. The listing itself is not changed, so pictures keep their identity.
- 2026-11-15: The delete summary counts the listed files; a sidecar honeycomb creates by the
  waiting write appears only in the toast and the trash bin.
- 2026-11-15: *Move…* has the same stale ETags after honeycomb's own writes; it is fixed in its
  own PR (TODO.md), as its plan and conflict probe are built before the waiting writes land.
- 2026-11-15: The owner's "delete all rejected" menu entry is the existing *Review rejects* (the
  reject review), now in the ⋯ menu at every width with `Ctrl+Backspace`; it keeps the glossary's
  name instead of a synonym like *Delete rejected*, and takes every reject whatever the filter.
- 2026-11-16: The folder picker is a WAI-ARIA tree with the root's folders as the top level and
  the arrow as the only way to expand, so a click on a row still ticks it as before; Left and
  Right expand and collapse, and reopening expands the folders above the ticked ones.
- 2026-11-16: The tree's arrow and rows are 34 px with a mouse and 44 px on a touch screen
  (`pointer: coarse`), as the flat list was, so the desktop tree stays compact.
