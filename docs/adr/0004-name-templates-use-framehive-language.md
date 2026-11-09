# 0004 – Name templates use Framehive's template language

- Status: accepted
- Date: 2026-11-09

## Context

Moving pictures renames them by a configurable pattern. The owner also uses Framehive, which
imports photos with a name template (IMPORT-001), and wants both apps to name files the same way.
A second, different template language would mean two sets of rules to learn and keep apart.

## Decision

honeycomb's name templates use Framehive's syntax and token names (`{date:%Y}`, `{name}`,
`{ext}`, `{number:N}`, `:lower`/`:upper`, `/` for folders, `.{ext}` at the end). honeycomb adds
`{camera}` and `{make}`, and allows only `[A-Za-z0-9._-]` in literals and token values, so no
generated path contains whitespace. The shared rules are in `docs/05-name-templates.md`, written
so Framehive can adopt them; this repository does not change Framehive.

## Consequences

- One template means the same in both apps, as far as honeycomb's subset reaches.
- Until Framehive adds `{camera}` and `{make}`, a honeycomb default template is invalid there;
  `docs/plan.md` lists that and the other alignments as follow-ups.
- Framehive's literal braces (`{{`, `}}`) and `%%` are rejected here; the suffix numbering
  differs (`-2` here, `-1` there) until one side changes.
