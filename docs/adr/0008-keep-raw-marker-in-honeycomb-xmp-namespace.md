# 0008 – The Keep RAW marker lives in a honeycomb XMP namespace

- Status: accepted
- Date: 2026-11-09

## Context

The owner wants a per-picture marker *Keep RAW*, so that *Remove RAWs* can move the RAWs of
every other pair to the trash bin ([`plan.md`](../plan.md#keep-raw-and-remove-raws)). Like every
decision it lives in the database and is written through to the XMP sidecars (ADR 0005). digiKam,
darktable and Lightroom have no field for it, and reusing one of theirs (a tag, a colour label,
`xmp:Label`) would change what those programs show.

## Decision

honeycomb writes the marker as `honeycomb:KeepRaw` with the value `True` in its own namespace
`https://github.com/polandy/honeycomb/xmp/1.0/`, preferred prefix `honeycomb`, and removes the
property when the picture is not marked. It is written only for a pair and read only for a pair.
Every other rule of [`06-xmp-interop.md`](../06-xmp-interop.md) applies: merging keeps foreign
properties, so the other programs keep the property untouched.

## Consequences

- digiKam, darktable and Lightroom ignore the marker; it does not show there.
- The namespace URI is fixed from now on; a later change needs a new version in the URI.
- Framehive does not know the namespace and keeps it like any unknown property (CORE-009.3).
