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
navigation. The entry opens the app's page for the logged-in user. While no folder set is chosen
the page shows an empty state, *No folder chosen*, with the folder picker open over it. Every
text the user reads comes from the translation catalogue (`t()`), except names taken from the
user's files. On a phone, below 520 px, every confirm dialog is a bottom sheet: full width, at
the bottom edge, rounded at the top only, its footer clear of the home indicator.

## Acceptance criteria

### APP-001.1 – The navigation opens the app page

- **Given** honeycomb is installed
- **When** a logged-in user opens its navigation entry, the app's root URL
- **Then** Nextcloud renders honeycomb's main template for that user

### APP-001.2 – Nextcloud 35 and PHP 8.3 only

- **Given** the app's `info.xml`
- **When** Nextcloud checks its requirements
- **Then** it accepts Nextcloud 35 only and PHP 8.3 or later

### APP-001.3 – Empty state without a folder set

- **Given** a user who has not chosen a folder set
- **When** the app page opens
- **Then** it shows *No folder chosen* with "Pick a folder to start culling." and opens the
  folder picker

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

## Out of scope

- The folder picker itself: LISTING-003.
- The grid that replaces the empty state: GRID-001.

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written from the merged code of #31 and #39 (ADR 0015) |
| 2026-11-10 | A confirm dialog is a bottom sheet on a phone (APP-001.6) |
