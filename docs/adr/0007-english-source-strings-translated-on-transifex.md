# 0007 – English source strings, translated through Nextcloud's Transifex

- Status: accepted
- Date: 2026-11-09

## Context

honeycomb is used in more languages than English; the owner works in German. Translations could
be kept in the repository by hand, or come from the translation community that Nextcloud runs on
Transifex for its own apps and for third-party apps that ask to join. On 2026-11-09 the owner
decided for Transifex, not a German translation kept here, and later the same day to set it up
only before the first App Store release: the app ships English only until then.

## Decision

- **Source strings are English**, written in the glossary's words (`docs/04-glossary.md`), and
  every user-visible string goes through `@nextcloud/l10n`: `t('honeycomb', …)`, and
  `n('honeycomb', '%n picture', '%n pictures', count)` for every string that contains a count.
  Placeholders are named (`{folder}`), never concatenated.
- **Translations come from Nextcloud's Transifex** once it is set up (see *Setup*): project
  `nextcloud`, resource `honeycomb`.
  Nextcloud's translation bot extracts the strings, uploads them, and commits the translations to
  `main` every night as `l10n/<lang>.js` and `l10n/<lang>.json`. These files are never edited by
  hand, like the lock files.
- **Language and locale follow Nextcloud.** The language is the user's Nextcloud language; the
  app has no language setting. Numbers, sizes and dates are formatted with `Intl.NumberFormat` and
  `Intl.DateTimeFormat` on the user's Nextcloud locale (`getCanonicalLocale()`), never with a
  fixed locale.
- **Name templates do not depend on the locale.** Their tokens and output are the same in every
  language (ADR 0004), so a moved file's name never changes with the user's language.
- **User-visible text comes from the frontend.** The API returns error codes, and the frontend
  turns them into `t()` strings. The few PHP strings, such as the navigation entry, go through
  `IL10N`.

## Setup

Deferred until before the first App Store release (`TODO.md`, `docs/plan.md` release
milestone). Until then the app ships English only, and `t()`, `n()`, `Intl` and the checks below
are mandatory from M1 all the same. In the repository then:

- `.tx/config` from Nextcloud's template: `[o:nextcloud:p:nextcloud:r:honeycomb]` with
  `file_filter = translationfiles/<lang>/honeycomb.po`,
  `source_file = translationfiles/templates/honeycomb.pot`, `source_lang = en`, `type = PO`, and
  the guide's `lang_map`.
- An empty `l10n/` with `l10n/.gitkeep`. `translationfiles/` is the bot's working folder and is
  ignored by Git.
- `.l10nignore` lists `js/`, `vendor/` and `docs/`, so the build output and the mockup's own
  `t()` are not extracted.
- `REUSE.toml` covers `l10n/**` once the first translations arrive.

Done by the owner then (issue #17): check the setup with `validateSyncSetup.sh` from
`nextcloud/docker-ci`, give `nextcloud-bot` write access, and open a *Request translations*
ticket in `nextcloud/docker-ci`. The bot commits to `main` directly, which clashes with the
planned pull-request-only ruleset; issue #17 also decides how to resolve that.

Source: Nextcloud's [translation
guide](https://docs.nextcloud.com/server/stable/developer_manual/app_development/translation.html),
read on 2026-11-09.

## Checks

From M2.1, in CI and `scripts/verify.sh`:

- eslint `vue/no-bare-strings-in-template`, with its default attributes (`aria-label`,
  `placeholder`, `title`, `alt`, …), fails on text in a template that does not go through `t()`.
- eslint `no-restricted-syntax` fails on a string literal or template literal passed straight
  to a message function (the undo toast, `@nextcloud/dialogs`' `show*`), and on a `t()` or `n()`
  whose app id or strings are not literals, because the extractor reads only literals.
- Vitest runs the components with a German stub catalogue in which every string is changed, and
  fails on English text left in the rendered output.

## Consequences

- Until the setup, only English exists; each language arrives afterwards when volunteers
  translate it. A missing string falls back to English, so a new feature ships in English first.
- The bot's nightly commits land on `main` without a pull request. release-please sees them as
  `fix(l10n)` commits.
- `@nextcloud/l10n` is a dependency of the frontend from M2.1 (CLAUDE.md rule 6: this ADR).
- The mockup's English/German switch is only for checking text length on the iPad. Its German
  strings are not a translation source and do not go to Transifex.
