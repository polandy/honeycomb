# 0005 – Decisions live in the database and are written through to XMP sidecars

- Status: accepted
- Date: 2026-11-09

## Context

Ratings, flags and colour labels must be fast to set in bulk on 2,000 pictures, resumable per
user, and visible in digiKam, darktable and Lightroom Classic on the desktop (Q2). The owner asked
for the decisions those programs already wrote to be taken over, too. Framehive writes the same
sidecars in the same folders (CORE-009).

## Decision

The app database is the working state (M2). Decisions are written through to the XMP sidecars of
every member in the fields of digiKam, darktable and Lightroom, and existing sidecars are read when
a picture is first listed (M5). Field mapping, precedence and write rules are in
`docs/06-xmp-interop.md`; sidecar names, merging, the serialized form and the checked save follow
Framehive's CORE-009 and LIBRARY-001, so both apps write the same sidecars.

## Consequences

- digiKam, darktable and Lightroom see honeycomb's decisions without an export step; what each
  cannot hold is listed in `docs/user/ratings-flags-colours.md`.
- Sidecars are shared by every user of a folder while the database is per user (Q20).
- M5 needs a PHP XML library that keeps every RDF form and unknown property: an ADR of its own.
