# Documentation

Open only the file, or the section, a change touches. `docs/` has two folders: [`user/`](user/) for
users and Nextcloud admins, [`dev/`](dev/README.md) for everyone who builds honeycomb.

| File | Contents |
|---|---|
| [`dev/01-requirements.md`](dev/01-requirements.md) | What we build: the owner's brief in English, incl. the 2026-11-09 update |
| [`dev/02-workflow.md`](dev/02-workflow.md) | Branch, test, pull request, review, screenshots, owner decisions |
| [`dev/03-coding-standards.md`](dev/03-coding-standards.md) | PHP, TypeScript and Vue idioms, tools, formatting |
| [`dev/conventions.md`](dev/conventions.md) | Rules for every language: design, names, constants, comments, errors, logging, tests, and the gate that checks each |
| [`dev/04-glossary.md`](dev/04-glossary.md) | The words we use for pairs, flags, labels and actions, and the UI conventions |
| [`dev/05-name-templates.md`](dev/05-name-templates.md) | Name templates for moved pictures: syntax, tokens, sanitising, collisions |
| [`dev/06-xmp-interop.md`](dev/06-xmp-interop.md) | XMP sidecars: digiKam, darktable and Lightroom fields, precedence, write rules, test vectors |
| [`dev/07-tags.md`](dev/07-tags.md) | Tags like digiKam's (concept): XMP fields, tag entry, bulk tagging, tag filter, decisions |
| [`user/`](user/) | Documentation for users, e.g. [culling a shoot](user/culling.md), [sidecars](user/sidecars.md), [shared folders](user/shared-folders.md), [ratings, flags and colours in other programs](user/ratings-flags-colours.md), [tags](user/tags.md), [keyboard shortcuts](user/keyboard-shortcuts.md), [settings](user/settings.md), [similarity](user/similarity.md) |
| [`user/admin/`](user/admin/) | Documentation for Nextcloud admins: [apps and commands](user/admin/apps-and-commands.md), [updating](user/admin/updating.md), the one-time migration for early installs, file locking, [removing](user/admin/removing.md), [releasing](user/admin/releasing.md) (package, signatures, App Store, the owner's certificate steps) |
| [`dev/specs/`](dev/specs/) | What the merged code does, one spec per feature, coupled to the tests (ADR 0015) |
| [`dev/plan.md`](dev/plan.md) | Milestones, project structure, target versions, open questions |
| [`dev/mockup/index.html`](dev/mockup/index.html) | The interactive mockup (milestone M0), with the tag entry (`T`) and the tag filter; open it in a browser |
| [`dev/plans/`](dev/plans/) | Concepts awaiting the owner's sign-off, e.g. [series in the loupe](dev/plans/loupe-series-concept.md) with its [mockup](dev/mockup/loupe-series/index.html), and manual test guides; the mockup of [editing series](dev/mockup/series-edit/index.html) (SERIES-005), the mockup of the [tile info button on touch](dev/mockup/tile-info-button.html) (GRID-004.12) |
| [`dev/ux-review.md`](dev/ux-review.md) | UX review of the mockup: findings, fixes, design direction; screenshots in [`dev/ux/`](dev/ux/) |
| [`dev/ux-review-2026-11.md`](dev/ux-review-2026-11.md) | UX review of the running app (2026-11): prioritised findings and fixes, each a `TODO.md` item |
| [`dev/adr/`](dev/adr/) | Architecture decision records, one file each |
| [`dev/decisions.md`](dev/decisions.md) | Smaller decisions made during implementation, one dated line each |

Only the current version of each document is kept; Git holds the history.
