# APP-001 – App page and navigation

- Status: implemented
- Area: app
- Origin: plan.md M1.1, M2.1, Translations, Target versions, Shared UI components; ADR 0007
- Depends on: LISTING-003

## Purpose

honeycomb is a Nextcloud app with one page. A user reaches it from Nextcloud's navigation and
starts from an empty state that leads to the folder picker.

## Behaviour

The app installs on Nextcloud 35 with PHP 8.3 or later and adds a *honeycomb* entry to the
navigation. The entry opens the app's page for the logged-in user. The page starts on *Folders*
(FOLDERS-007), or on the library setup while the user has no library root; the folder picker
opens only from the navigation. Every
text the user reads comes from the translation catalogue (`t()`), except names taken from the
user's files. On a phone, below 520 px, every confirm dialog is a bottom sheet: full width, at
the bottom edge, rounded at the top only, its footer clear of the home indicator. When the
browser asks for reduced motion, a dialog opens and closes without a fade or a zoom, which
`NcModal` would otherwise play.

Nextcloud's navigation beside the page holds only *Folder*, the recent folder sets and
*Settings*, so it starts closed below 1280 px, where the grid needs the room. Once the user opens
or closes it with Nextcloud's toggle, the app keeps that choice in the browser and starts with it
on every width. Below 1024 px Nextcloud shows the navigation over the page and closes it itself;
there the app neither applies nor remembers a choice.

Every route that writes is limited to 600 requests a minute per user, the visual hash save to
300 (SERIES-003.23); Nextcloud answers a request beyond the limit `429` without running it
(ADR 0031). The routes that only read are not limited.

Each page loads its script by the name the build gave it, which carries a hash of its content
(ADR 0033), so a new build reaches the browser on the next page load even when the app version
stays the same.

## Acceptance criteria

### APP-001.1 – The navigation opens the app page

- **Given** honeycomb is installed
- **When** a logged-in user opens its navigation entry, the app's root URL
- **Then** Nextcloud renders honeycomb's main template for that user

### APP-001.2 – Nextcloud 35 and PHP 8.3 only

- **Given** the app's `info.xml`
- **When** Nextcloud checks its requirements
- **Then** it accepts Nextcloud 35 only and PHP 8.3 or later

### APP-001.3 – Start without library roots

- **Given** a user without a library root
- **When** the app page opens
- **Then** it shows the library setup, *Where is your library?* (FOLDERS-007.2), and the folder
  picker stays closed

### APP-001.4 – Every text is translatable

- **Given** any screen of the app
- **When** it renders
- **Then** every text it shows comes from the translation catalogue, except names of folders and
  files

### APP-001.5 – An unexpected error is logged

- **Given** the app is running
- **When** an error reaches Vue that no component handles
- **Then** it is logged as an error together with its cause

### APP-001.6 – A dialog is a bottom sheet on a phone

- **Given** a screen at most 520 px wide
- **When** a confirm dialog opens, e.g. the folder picker
- **Then** it spans the full width, rests on the bottom edge, leaves at least 24 px above it and
  has rounded top corners only

### APP-001.7 – The navigation starts closed below 1280 px

- **Given** a user who has never opened or closed the navigation in this browser
- **When** the app page opens on a screen at least 1024 px wide
- **Then** the navigation is open from 1280 px on and closed below; below 1024 px Nextcloud
  decides alone

### APP-001.8 – The navigation remembers the user's choice

- **Given** a screen at least 1024 px wide
- **When** the user opens or closes the navigation with its toggle and later opens the app page
  again
- **Then** the navigation starts as the user left it, at any width from 1024 px on; a choice made
  below 1024 px is not remembered

### APP-001.9 – Every write route is limited per user

- **Given** a route that writes: a save, the move or the trash
- **When** one user sends it more than 600 times within a minute (300 for the visual hash save)
- **Then** Nextcloud answers the further requests `429` and runs none of them

### APP-001.10 – A new build reaches the browser

- **Given** a build of honeycomb, deployed with the same app version as the one before
- **When** a user opens the app page or the similarity page
- **Then** the page loads its script by the content-hashed name the build wrote, so the
  browser fetches the new script instead of a cached one; without a build the page fails loud

### APP-001.11 – The navigation toggle sits in the toolbar row

- **Given** the grid with its toolbar, from an iPad width on, the navigation open or closed
- **Then** exactly one toggle shows, centred vertically in the toolbar row, with no toolbar
  control under it; hovering it keeps it fully opaque and tints its background

### APP-001.12 – A dialog closed while it opens logs no error

- **Given** a dialog that is taken away before its opening fade has ended, such as the folder
  picker confirmed at once, or the series compare opened from the toolbar, the `n` key or a series
  badge right after
- **Then** its focus trap is skipped and nothing is logged as an error; any other error is still
  logged as one (APP-001.5)

### APP-001.13 – An error toast stays until it is closed

- **Given** a toast that reports a failure, such as *Could not save the settings*, *Could not
  clear the cache.*, *Could not move the photos* or *Not changed: read only*
- **When** the user looks away and back, however long it takes
- **Then** the toast is still there, announced by a screen reader at once (`role="alert"`), with a
  *Close* button; another toast replaces it; a toast that reports success keeps its timer and
  stays a polite status (`role="status"`)

### APP-001.14 – A toast's details open in a dialog

- **Given** a toast with *Details*, such as *Picked 7 photos; 3 photos not changed: read only*
- **When** the user chooses *Details*, by touch or with the keyboard
- **Then** the toast closes and a dialog lists the toast's message and each detail, one per line,
  with *Close*; the dialog traps the focus and `Esc` closes it

### APP-001.15 – No serious accessibility fault, light or dark

- **Given** the real app in the light and in the dark theme
- **When** the grid, folder tree, settings, selection, *Move…*, ⋯ menu, reject review, *Delete…*,
  loupe, gesture guide, series compare and series viewer are open
- **Then** an axe-core scan (WCAG 2.2 A and AA rules, ADR 0042) finds no fault rated *moderate*,
  *serious* or *critical*, contrast included; a known fault is excluded only by its rule and
  element, each with a `TODO.md` item; the same scan fails any visible text under 12 px

### APP-001.16 – Escape closes a dialog from a switch or a checkbox

- **Given** a confirm dialog that can be cancelled, such as the folder picker, with the focus on a
  switch, checkbox or radio button in it, as after it opens with *Include subfolders* first
- **When** the user presses *Escape*
- **Then** the dialog closes as by *Cancel*; a dialog without *Cancel* stays open, and in a text
  field *Escape* stays the field's

### APP-001.17 – A dialog opens without motion when the browser asks for less

- **Given** the browser asks for reduced motion
- **When** a dialog opens, such as the folder picker on the empty state
- **Then** neither the dialog nor anything in it plays a transition or an animation; it stands
  at its place from its first frame

### APP-001.18 – Every toast can be dismissed

- **Given** any toast, one that reports success or a failure
- **When** the user presses its *Close* button, or swipes it sideways by at least 60 px on a touch
  screen
- **Then** the toast goes at once; a shorter or mostly vertical move keeps it, and a toast the
  focus or a press holds keeps its timer stopped

### APP-001.19 – A toast can stay longer

- **Given** a toast shown with its own duration, such as the 8 s of *Marked ⟨folder⟩ done*
  (FOLDERS-008.3)
- **When** the user neither holds nor dismisses it
- **Then** it goes after that duration; every other success toast goes after 5.2 s, and after a
  hold it runs its own full duration again

### APP-001.20 – The gesture guide and the tag entry are modal

- **Given** the gesture guide or the tag entry open
- **When** the user presses `Tab`, `Shift+Tab` or `Esc`, or a screen reader walks the page
- **Then** the dialog is marked modal and the rest of the page is inert while it is open, so the
  focus stays inside it and wraps from its last control to its first and back; `Esc` closes it
  alone (the guide as *Got it*); once it is gone the page behind is live again and the focus is back
  on the control that opened it

### APP-001.21 – The page opts in to the whole screen and keeps its controls clear of the cutouts

- **Given** the app page on a device with a camera cutout, a status bar or a home indicator
- **When** the page loads
- **Then** its viewport says `viewport-fit=cover` (added to Nextcloud's, once, whatever it already
  says), and the page and the loupe pad their edges with `env(safe-area-inset-*)`, so the
  loupe's background runs under the bars while no control lies under them

### APP-001.22 – Every page has one title row that clears the navigation toggle

- **Given** a page of the app with a title: the library setup and the *Library* or a root's folder
  list; the grid's and the Immich grid's toolbars keep their own row (APP-001.11)
- **When** the toggle floats over the content, on a screen narrower than 1024 px or with the
  navigation closed
- **Then** the title row is as tall as the toolbar row and its left padding keeps the title clear
  of the toggle, so their boxes do not overlap; with the navigation open on a wide screen the
  title sits flush left

## Out of scope

- The folder picker itself: LISTING-003.
- The grid that replaces the empty state: GRID-001.

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written from the merged code of #31 and #39 (ADR 0015) |
| 2026-11-10 | A confirm dialog is a bottom sheet on a phone (APP-001.6) |
| 2026-11-13 | The navigation starts closed below 1280 px and remembers the user's choice (APP-001.7, APP-001.8; UX L3) |
| 2026-11-15 | Every write route is rate limited per user (APP-001.9, ADR 0031, risk review R10) |
| 2026-11-16 | Each page loads its script by its content-hashed name (APP-001.10, ADR 0033) |
| 2026-11-17 | The navigation toggle is centred in the toolbar row, alone and opaque on hover (APP-001.11) |
| 2026-11-18 | A dialog closed while it opens logs no focus trap error (APP-001.12) |
| 2026-11-18 | An error toast stays until closed and is announced as an alert; a toast's details open in a dialog (APP-001.13, .14; review UX-1, UX-2) |
| 2026-11-19 | An axe-core scan of every screen, light and dark (APP-001.15, ADR 0042; review UX-5) |
| 2026-11-20 | A dialog opens without motion under reduced motion (APP-001.17) |
| 2026-11-22 | Every toast has *Close* and goes by a sideways swipe; a toast may stay longer (APP-001.18, .19; M12 PR 6) |
| 2026-11-25 | Every page has one title row that clears the navigation toggle (APP-001.22) |
| 2026-11-20 | *Escape* closes a confirm dialog also from a switch or a checkbox, which `NcModal` leaves to the field (APP-001.16) |
| 2026-11-24 | The gesture guide and the tag entry are modal: inert page, focus trap, `Esc` (APP-001.20; Fable review) |
| 2026-11-24 | The page opts in to `viewport-fit=cover` and pads its edges with the safe areas (APP-001.21; Fable review) |
| 2026-11-22 | The page starts on *Folders* or the library setup, the picker no longer opens by itself (APP-001.3, M12 PR 5) |
