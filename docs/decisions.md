# Decisions

Smaller decisions made during implementation, one dated line each; larger ones become an
[ADR](adr/).

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
- 2026-11-10: A warming job takes 200 file ids, so its JSON argument stays below the job
  table's 4,000 characters; a file it cannot find or render is skipped with a debug log line.
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
- 2026-11-10: Icon-only controls carry an `aria-label` and no tooltip until the shared `Tooltip`
  component exists (`TODO.md`); the native `title` stays unused.
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
- 2026-11-10: The scope's "The flag filter overrides this" is visible text beside the disabled
  segment, tied to it by `aria-describedby`, until the shared `Tooltip` exists.
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
- 2026-11-10: The info panel's open state and width are kept in the browser's local storage; the
  filmstrip starts open on each opening. The < 100 ms budget is not yet measured.
- 2026-11-10: The "Nextcloud app navigation" the loupe covers is Nextcloud's header with the app
  menu; honeycomb has no navigation of its own yet. A pressed toggle at the end of the title row
  shows the header above the loupe, kept in the browser like the info panel; chrome-free mode
  still covers it, and the loupe is no longer `aria-modal` while it shows.
- 2026-11-10: The gesture guide lists only what the loupe does today: sideways swipes, the tap
  zones with their sketch, pinch and double-tap, and the keys `←` `→`, `Z` and `Esc`. The swipe
  up and down line joins with M3.2 and the mockup's keys line (`P`, `X`, `U`, `Z`, `?`) with
  M3.3, so the guide, shown once, never names a gesture that does nothing.
- 2026-11-10: The gesture guide counts as seen in the browser's local storage, like the info
  panel; with site data blocked it shows on each opening. Showing it again from the settings is
  the UX review's L6 in `TODO.md`.
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
