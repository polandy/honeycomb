# 0053 – What happens to honeycomb's data when the app is removed

- Status: accepted (B, autonomous within the owner's go of 2026-11-24, issue #187)
- Date: 2026-11-23, decided 2026-11-24
- Amends: the 2026-11-14 entry in `docs/dev/decisions.md` ("no uninstall step that deletes user data")

## Context

The isolation check of 2026-11-22 (fix T4) asked for an uninstall repair step, so that
`occ app:remove honeycomb` removes honeycomb's tables, its `oc_migrations`, `oc_appconfig` and
`oc_preferences` rows and its `oc_jobs` row, and `occ app:remove --keep-data honeycomb` keeps them.
`docs/user/admin/removing.md` lists what stays today.

Nextcloud 35.0.2 and 35.0.3 (the same code in both, checked again on 2026-11-23) run uninstall
repair steps in `OC\App\AppManager::disableApp()`, not in the removal:

- `occ app:remove honeycomb` calls `disableApp()`, which runs the uninstall steps, then deletes
  the app folder (`core/Command/App/Remove.php`).
- `occ app:remove --keep-data honeycomb` skips `disableApp()`: no uninstall step runs, and
  `enabled` stays `yes`.
- `occ app:disable honeycomb` and disabling the app on the admin's Apps page call the same
  `disableApp()`, so they run the uninstall steps, too.
- A Nextcloud upgrade disables every app not marked compatible with the new version
  (`lib/private/Updater.php`, `disableApp($app, true)`), so it runs them as well.

An uninstall step cannot tell a removal from a disable: the app folder still exists in both. A
step that drops the tables would therefore delete every user's ratings, flags, tags, series and
settings when an admin only disables honeycomb, or when a Nextcloud major upgrade arrives before
honeycomb's `max-version` is raised.

## Options

- **A, an uninstall step that drops everything:** what T4 asked for; `app:remove` cleans up and
  `--keep-data` keeps the data, but every disable and every upgrade that finds honeycomb
  incompatible deletes all users' data without a warning.
- **B, no uninstall step; `occ honeycomb:cleanup --all` removes the rest:** the owner's decision
  E16 of 2026-11-19 already chose `honeycomb:cleanup --all` over an uninstall step. It empties
  the tables and the `oc_preferences` rows today; B extends it to also drop the tables and delete
  the `oc_migrations`, `oc_appconfig` and `oc_jobs` rows, and the admin runs it before
  `occ app:remove`. No uninstall step at all: `enableApp()` adds no background job again, so even
  a step that removed only the `oc_jobs` row would lose the clean-up job after a disable and
  enable.
- **C, no change:** keep today's `honeycomb:cleanup --all` (rows only) and the hand-written SQL
  for the tables, `oc_migrations` and `oc_appconfig` in `docs/user/admin/removing.md`.

Recommendation: B. No disable ever deletes data, and removing it for good is one command instead
of hand-written SQL per database, and it keeps E16.

## Decision

B, with the drop behind its own option: `occ honeycomb:cleanup --all --drop` drops every honeycomb
table that exists, also those of older releases, and deletes honeycomb's `oc_migrations`,
`oc_preferences`, `oc_jobs` and `oc_appconfig` rows (DECISIONS-001.38). `--all` alone keeps
emptying the rows and leaves a working, empty app.

- **Own option, not a wider `--all`:** `--all` is documented as leaving honeycomb working; a
  drop leaves it without tables, so it is asked for by name.
- **`oc_appconfig` goes too,** the Immich `connections_file` path included: without
  `installed_version` and `enabled`, Nextcloud treats honeycomb as not installed, so
  `occ app:enable honeycomb` installs it fresh and `occ app:remove honeycomb` leaves nothing.
- **Not one transaction:** tables cannot be dropped inside one on every database. Every part
  skips what is gone already, so a failed run is finished by running it again.
- **The reinstall before 0.2.0 is a pre-migration repair step the admin asks for** (ADR 0055).
  While an enabled app's code is newer than its installed version, Nextcloud 35 loads no app
  command ("Nextcloud or one of the apps require upgrade"), so the 0.2.0 command cannot run before
  the update, and the old release has no `--drop`. Instead the admin sets
  `occ config:app:set honeycomb reinstall --value=yes`, a core command that works in that state,
  and updates as usual: the step `ReinstallBeforeBaseline` drops the tables and forgets the
  migrations, and the baseline creates them again (DECISIONS-001.39). Without that value the
  baseline still stops and names the tables, so no update deletes data unasked. The step acts
  only below 0.2.0, deletes the value either way, and keeps the users' settings and the app
  config, as the hand-written SQL did. Checked against Nextcloud 35.0.3 with an instance
  installed from the chain before the baseline, the 0.2.0 code put in place, and a failed
  `occ upgrade` before the value was set.
- **A test server that ran an older baseline** has no version change and keeps its commands, so
  it reinstalls with `--drop` and `occ app:enable honeycomb`.

## Consequences

- No disable, removal or Nextcloud upgrade deletes data on its own; only the admin's command does.
- A drop cannot be undone; the guides ask for a database backup first.
- Each table a later release adds is dropped only if it is in the command's list; a database test
  compares the list with the schema.
