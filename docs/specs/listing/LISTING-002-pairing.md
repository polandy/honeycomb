# LISTING-002 – Pairing

- Status: implemented
- Area: listing
- Origin: plan.md M1.3, Pairing and file types (Q14, Q15, Q16), Multiple folders item 4
- Depends on: LISTING-001

## Purpose

The client groups the listed entries into pictures: a RAW and a rendered member of the same shot,
or a single, each with its sidecars. Every later step culls pictures, never files.

## Behaviour

Pairing is pure TypeScript (`src/logic/pairing.ts`) on the entries of LISTING-001 and the
pairing settings (SETTINGS-001). The test vectors in `tests/fixtures/pairing/vectors.json` are
shared with framehive.

- A file is a RAW or rendered member by its extension, compared ignoring case. Defaults: RAW
  `nef, cr2, cr3, arw, raf, orf, rw2, dng, pef, srw`; rendered `jpg, jpeg, heic, heif, hif`. A
  sidecar ends in `.xmp`. Other files are not part of any picture.
- The base name runs up to the last dot and is compared ignoring case; a picture shows it as
  written on its RAW member, else on its rendered member.
- Members pair only within one folder. One RAW and one rendered member of a base name form a
  pair; one alone is a single. Two RAW or two rendered files of a base name pair nothing: every
  file of it is a single marked ambiguous.
- A sidecar named after a member (`A.NEF.xmp`, also a darktable duplicate `A_01.NEF.xmp`)
  belongs to that member's picture; one named after the base name (`A.xmp`) is shared by the
  picture. A sidecar that matches no member, or two members, belongs to no picture.
- *Separate subfolders* mode: the user names a RAW and a rendered subfolder (default `RAW` and
  `JPG`, ignoring case); members in them pair as if they lay in their parent folder, beside its
  own files. The subfolders of two different folders never pair. In *Same folder* mode such
  subfolders are ordinary folders.
- Settings with an extension in both lists, `xmp` as a member extension or an empty extension
  are rejected with an error that names the extension.

## Acceptance criteria

### LISTING-002.1 – A RAW and a rendered file of one shot pair

- **Given** `A.NEF` and `A.JPG` (or `A.HEIF`) in one folder
- **When** the entries are paired
- **Then** they form one picture with the RAW and the rendered member

### LISTING-002.2 – Case and dots

- **Given** members whose base names or extensions differ only in case, or names with several
  dots
- **When** the entries are paired
- **Then** base names and extensions compare ignoring case, the base name runs up to the last
  dot, and the picture shows the base name as written

### LISTING-002.3 – Singles

- **Given** a JPEG without a RAW, or a RAW without a JPEG
- **When** the entries are paired
- **Then** each is a single picture

### LISTING-002.4 – Ambiguous base names pair nothing

- **Given** two RAW or two rendered files of one base name, such as `A.JPG`, `A.jpg`, `A.NEF`
- **When** the entries are paired
- **Then** every file of that base name is a single marked ambiguous, and its tile shows the
  warning

### LISTING-002.5 – Pairing stays within one folder

- **Given** `A.NEF` and `A.JPG` in different folders, in *Same folder* mode
- **When** the entries are paired
- **Then** they do not pair

### LISTING-002.6 – Sidecars follow their member

- **Given** sidecars named after a member, after the base name, after a darktable duplicate, or
  after no member
- **When** the entries are paired
- **Then** each belongs to its member's picture, is shared by the picture, or belongs to none;
  one that matches two members belongs to neither

### LISTING-002.7 – Extension lists decide what a picture is

- **Given** extension lists from the settings, in any case and with or without a leading dot
- **When** the entries are paired
- **Then** only files with a listed extension are members, an added extension pairs, and other
  files are not pictures

### LISTING-002.8 – Defaults

- **Given** no pairing settings of the user
- **When** the entries are paired
- **Then** the default RAW and rendered lists and *Same folder* mode apply

### LISTING-002.9 – Separate subfolders

- **Given** *Separate subfolders* with named RAW and rendered subfolders
- **When** the entries are paired
- **Then** the two subfolders pair as their parent folder together with its own files, the
  subfolders of two folders do not pair, and the names are a setting

### LISTING-002.10 – Invalid settings are refused

- **Given** an extension in both lists, `xmp` as a member extension, or an empty extension
- **When** the entries are paired
- **Then** pairing fails with an error that names the extension

### LISTING-002.11 – One notice for ambiguous names

- **Given** a folder whose pictures include ambiguous singles
- **When** the grid shows it
- **Then** the grid shows, above the tiles and beside the warning on each tile, one notice for
  each ambiguous base name of that folder that names it and counts its shown singles

## Out of scope

- The settings that change the extension lists and the folder mode: SETTINGS-001.
- Pair badges on tiles: GRID-001.

## History

| Date | Change |
|---|---|
| 2026-11-10 | Written from the merged code of #38 (ADR 0015) |
