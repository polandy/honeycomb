# 1. Requirements

The owner's brief of 2026-11-09, translated into English. The brief itself is kept outside the
repository. Where the owner update (section 1.8) and the original brief differ, the update wins.
Questions that are still open are in [`plan.md`](plan.md#open-questions), never here.

## 1.1 Goal

The owner shoots RAW+JPEG. Every photo is two files with the same base name, for example
`DSC_0412.JPG` and `DSC_0412.NEF`. honeycomb always treats them as **one picture**: look at it
once, decide once, delete both files together.

## 1.2 Folder

The user picks a folder in their Nextcloud files; the app shows its images.

## 1.3 Pairing

- Pairs are found by base name, ignoring upper and lower case.
- RAW extensions are configurable. Default: `nef`, `cr2`, `cr3`, `arw`, `raf`, `orf`, `rw2`,
  `dng`, `pef`, `srw`.
- Optional and configurable: RAWs and JPEGs in separate subfolders (for example `/RAW` and
  `/JPG`).
- Singles without a partner (JPEG only or RAW only) are clearly marked and can be filtered
  separately.

## 1.4 Review

- A grid of thumbnails, each with a badge that shows whether the pair is complete.
- A full-screen view: swipe to go to the next or previous picture, pinch to zoom, a button or
  Space for 100 %, double-tap or F for the view without chrome (2026-11-09).
- Per picture, a decision by large button and by swipe gesture (for example up/down).
- The JPEG is shown; only when there is no JPEG, the RAW's embedded preview.
- Undo for the last decisions.
- The next pictures are preloaded so paging stays smooth.

## 1.5 Deleting

- Rejected pictures are only marked at first.
- A "Delete N pairs" button shows a summary (number of files, disk space) and, after
  confirmation, deletes JPEG, RAW and any XMP sidecars together.
- Deleting goes through the normal Nextcloud file layer, so everything lands in the Nextcloud
  trash bin and can be restored. Never delete directly in the file system.
- Deleting a pair is meant to be atomic: if one file fails, this is reported and the state stays
  traceable.

## 1.6 Settings (per user)

RAW extensions, folder mode (same folder or separate subfolders), gesture mapping, whether
singles are shown.

## 1.7 Technology and quality

- Target the current Nextcloud version; check the supported versions and the matching PHP
  version before writing `info.xml` (done in [`plan.md`](plan.md#target-versions)).
- Backend: PHP with the Nextcloud App Framework (controllers, services). Files only through
  `OCP\Files` (`IRootFolder`), respecting the user's permissions.
- Frontend: Vue with `@nextcloud/vue` and `@nextcloud/axios`, Nextcloud look, light and dark mode.
- Thumbnails and previews through the Nextcloud preview API. Document the app
  `camerarawpreviews` as a recommended dependency for RAW previews.
- Touch-first: large hit targets, no hover-only interaction, tested in iPad landscape and
  portrait.
- Decisions are stored on the server, so a review can be interrupted and resumed later.
- Performance: folders with 2,000+ pairs load without stalls (pagination or virtual scrolling).
- PHPUnit tests for pairing, including: names differing only in case, several dots in a file
  name, files without a partner, separate folders.
- Tests for deleting, including failure cases.
- README with installation, features and screenshot placeholders. Licence AGPL-3.0.
- Before code: a short plan with milestones, project structure and open questions. Then build
  milestone by milestone: backend pairing with tests, grid, full-screen review, deleting and
  settings.

## 1.8 Owner update 2026-11-09

Before any production code, build an interactive mockup of how the app should work, and refine
the requirements on it with the owner. The goal: culling photos in Nextcloud the way digiKam does
it — filters, star ratings, colour labels, pick and rejected flags, fast image loading, selecting
several images and then deleting them, and other bulk actions. The details are worked out
together on the mockup ([`mockup/index.html`](mockup/index.html), ADR 0003).

This widens the brief's binary keep/discard decision to digiKam's ratings, colour labels and
pick labels; [`plan.md`](plan.md#open-questions) Q2 and Q4 settled how.
