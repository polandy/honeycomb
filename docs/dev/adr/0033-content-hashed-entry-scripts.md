# 0033 – Content-hashed entry scripts

- Status: accepted
- Date: 2026-11-16

## Context

Nextcloud adds an app script with `Util::addScript()` and a cache buster `?v=` built from the app
version only (`TemplateLayout::getVersionHashByPath()` in Nextcloud 35), and serves `js/` with
`Cache-Control: max-age=15778463`, six months. Every build of `main` carries the version of the
last release, so a build deployed to nc-test with the same version kept the old script in a
browser that had opened honeycomb before: the owner did not see the folder tree of #234, although
nc-test served it. The chunks are hashed already; only the two entries, `honeycomb-main.mjs` and
`honeycomb-similarity.mjs`, had fixed names.

The options:

- **Bump the version for every test build:** Nextcloud then asks for an app upgrade on each
  deploy, and the version would no longer be release-please's.
- **Tell testers to reload without cache:** easy to forget, and the stale page looks like a bug
  in the new build.
- **Hash the entry names and let the build tell PHP the names:** every build that changes a
  script gets a new URL, whatever the version. Vite's JSON manifest would need
  `file_get_contents`, which psalm forbids (CLAUDE.md rule 1), so the build writes a PHP file.

## Decision

Vite names each entry `js/honeycomb-<entry>-<hash>.mjs`, and a plugin in `vite.config.ts` writes
`js/scripts.php`, which returns the script name of each entry (`main`, `similarity`).
`ScriptManifest` loads it with `require` and returns the name of an entry; `PageController`
passes it to the page template, which adds it with `Util::addScript()`. A missing file or entry
throws `ScriptManifestException`, so an unbuilt app fails loud instead of rendering an empty
page. `npm run build` empties `js/` first, so no script of an older build is packed.

## Consequences

- A deploy shows the new UI on the next page load, with or without a version change; unchanged
  scripts keep their name and stay cached.
- The page loads one small generated PHP file per page load; OPcache keeps it.
- `js/scripts.php` is packed with the app; it lists only the built file names.
