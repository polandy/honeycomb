# Plan: testing honeycomb on a real Nextcloud

The owner's go of 2026-11-11: honeycomb is tested once on a real Nextcloud, with real photos,
before any Transifex work ([Translations](../plan.md#translations)). CI already runs Playwright
against a fresh Nextcloud container with drawn images (`scripts/e2e-server.sh`); this plan covers
what CI cannot: the owner's own RAW files, a real iPad, real shared folders and real timing.

This is a test plan, not a spec. Findings become `TODO.md` items or issues
([What happens after](#what-happens-after)).

## Where to test

Use a **separate, throwaway test Nextcloud**, never the owner's production instance.

| Option | Verdict |
|---|---|
| Throwaway Nextcloud (container or VM) with its own data directory | **Preferred.** Safe to break, reset and delete |
| Production instance, app installed by the owner | Owner decision, see [Production](#production-as-an-option) |

### Versions

Match `appinfo/info.xml`: Nextcloud **35** (min and max are both 35) and PHP **8.3** or newer
([Target versions](../plan.md#target-versions)). Take the image CI uses, pinned in
`scripts/e2e-server.sh` (`NEXTCLOUD_IMAGE`, an `apache` 35.x image by digest), so the test
and CI agree. Use a real database (MariaDB or PostgreSQL) and Redis for file locking instead of
CI's SQLite, because the move and trash paths and the file cache behave under load as in
production. Serve it over HTTPS (a reverse proxy with a local certificate): the iPad's Safari
needs it for a realistic test, and some touch features only work in a secure context.

### Setup

1. Start the test Nextcloud on a host or VM that is **not** the production server, with data on
   its own volume and a name that cannot be confused with production (for example
   `nc-test.<lan-domain>`). It must have no mount of the photo library, no external storage and no
   sync client configured against it.
2. Create the admin and the test users ([Users](#users)); keep the passwords in the owner's
   password manager, not in the repository.
3. Install the recommended optional apps from the README: `camerarawpreviews` and Preview
   Generator. Test once without them and once with them ([Checklist](#checklist)).
4. Install honeycomb ([How the app gets installed](#how-the-app-gets-installed)).
5. Copy the [test data](#test-data) in through the web interface or WebDAV, then run
   `occ files:scan` for each test user.

### Teardown

1. `occ app:disable honeycomb`, then remove the app folder.
2. Delete the test users with `occ user:delete`; delete the trash bin of each first
   (`occ trashbin:cleanup --all-users`).
3. Destroy the container or VM **and its data volume and database**. Check with `docker volume ls`
   (or the VM manager) that nothing is left over.
4. Delete the cleaned photo copies from the test host.

### How the app gets installed

The release pipeline and the signing certificate do not exist yet (`TODO.md`), so the test
installs a **build artefact**, which is also what the future tarball contains.

1. On the development machine, from a clean checkout of the commit under test:
   `composer install --no-dev`, `npm ci`, `npm run build`.
2. Pack the app as `honeycomb/` without `node_modules`, `tests`, `docs`, `.git` and other
   development files: `tar -czf honeycomb-test.tar.gz` of the folder. Note the commit hash.
3. Unpack it into the test server's `custom_apps/` (or another folder in `apps_paths`), owned by
   the web server user, and run `occ app:enable honeycomb`.
4. Do **not** bind-mount the Git checkout the way `scripts/e2e-server.sh` does for CI: the test
   should exercise the packaged files, and a mount would let the server write into the checkout.

An unsigned app triggers a code integrity warning in *Administration settings → Overview*; that
is expected until the signing certificate exists and is not a finding.

### Production as an option

Installing the build into the owner's production Nextcloud is **not part of this plan**. If the
owner wants it anyway, these are the risks to weigh:

- honeycomb moves and trashes files. A bug in the move or the trash path acts on real photos;
  the trash bin is the only safety net and has a retention and quota limit.
- The decisions, the XMP sidecars and the move report are written next to the owner's real
  files; a sidecar bug changes metadata that digiKam, darktable and Lightroom read.
- Background jobs for previews add load, and thousands of generated previews take disk space.
- The app is pre-release: no signature, no upgrade path guaranteed, `0.0.0` as version.
- An app that failed to enable or upgrade cleanly can leave database tables or app config behind.
- Sync clients propagate every move, rename and deletion to every device at once.

If chosen, the minimum safeguards would be a fresh backup (files and database), a dedicated
test user and test folder, and the throwaway checklist passed first. This stays an
[owner decision](#open-owner-decisions).

### What must never touch production data

- The original photo library is **read-only** for this test: copy out, never open a writable
  mount, never run honeycomb or a sync client against the original folders.
- The test Nextcloud shares no database, data directory, Redis, trusted domain, sync account or
  credentials with production.
- No test step runs `occ`, `docker` or any tool against the production instance.
- Cleaned copies stay on the test host and are deleted at teardown; they are never committed
  to this repository or attached to an issue or PR.

## Test data

### Source and cleaning

1. Pick about 150 to 300 pictures from the owner's library, copy them (copy only, from a
   read-only view of the library) into a working folder outside the library.
2. Choose pictures **without recognisable people**: landscapes, architecture, objects. No
   faces, no children, no number plates, no readable addresses.
3. Clean every copy, JPEG, RAW and sidecar:
   - Remove serial numbers (camera body, lens, internal), owner and artist name, and GPS.
   - From each XMP sidecar remove people names (`mwg-rs` regions, `MPRI`, `digiKam` person
     tags) and face regions, and any keyword or description that names a person or a place.
   - Keep what honeycomb reads: capture time, orientation, dimensions, rating, label, flag
     ([`06-xmp-interop.md`](../06-xmp-interop.md#field-mapping)).
4. Check the result with a metadata tool: print all tags of a sample and grep for serial,
   GPS, name and region fields. The check passes only when none is left.
5. Never edit the originals. If a RAW cannot be cleaned without damaging it, drop it from
   the set.

### Contents

| Group | What | Why |
|---|---|---|
| RAW+JPEG pairs | Canon `.CR3` and Samsung `.SRW` with a same-named JPEG | Pairing, extension listing (#96) |
| RAW only | A few `.CR3` and `.SRW` without a JPEG | Embedded preview, singles |
| JPEG only | Several 24 MP JPEGs | Singles, budget measurement |
| Case and name quirks | `IMG_0001.JPG` with `img_0001.cr3`; names with spaces and umlauts | Pairing ignores case |
| Sidecars | `<file>.xmp` per member, a shared `<base>.xmp`, one pair with both | [Sidecar names](../06-xmp-interop.md#sidecar-names) |
| Sidecar origins | Sidecars written by digiKam, darktable and Lightroom Classic | XMP interop |
| Folder layouts | Mixed folder; RAWs and JPEGs in separate subfolders | Folder layout setting |
| Big folder | 2,000+ pairs, made by copying the set repeatedly with new names | Grid and budgets |
| Series | A burst of near-identical frames | Series compare and viewer |
| Collisions | A target folder that already holds a name the move would use | Move conflicts |

For the big folder only the file sizes and counts matter, so repeated copies are fine; keep a
few distinct 24 MP files in it for the budget run.

### Users

| User | Role |
|---|---|
| `owner-test` | Owns the photo folders, runs most of the checklist |
| `second-test` | Receives a shared folder (read-write) and another one (read-only) |
| `third-test` | Opens honeycomb with no files, and as a second device user for view state |
| admin | Installs the app, runs `occ`, and looks at logs only |

Share one folder read-write and one read-only from `owner-test` to `second-test`, plus one
folder shared as a link for a negative check.

## Checklist

Mark each item pass or fail, with the commit hash, the date and the device. A failed item gets
a note and a screenshot; photos in screenshots come from the cleaned set only.

### 1. Install and enable

| Check | Pass criterion |
|---|---|
| `occ app:enable honeycomb` | Exits 0, no PHP warning in `nextcloud.log` |
| Navigation entry | honeycomb shows for every user and opens its page |
| Logs after first use | No `error` or `warning` entries from honeycomb |
| Missing optional apps | Without `camerarawpreviews` the app works; RAW-only pictures show a clear placeholder rather than a broken image |
| Admin overview | No other warning than the expected missing signature |

### 2. Listing

| Check | Pass criterion |
|---|---|
| Open a mixed folder | Pairs are one picture each; RAW-only and JPEG-only are marked as singles |
| `.CR3` and `.SRW` | Listed, served and previewed by extension (LISTING-001) |
| Case-insensitive pairing | `IMG_0001.JPG` and `img_0001.cr3` form one pair |
| Subfolders | With subfolders the set covers the tree; the skipped folders stay skipped |
| Separate RAW and JPEG folders | Pairs form across the layout set in *Settings* |
| Shared folders | `second-test` lists the read-write and the read-only folder; paths are theirs |
| Link share and foreign paths | A path outside the user's files returns an error, not data |
| Count | The number of pictures matches `occ files:scan` counts of the folder |

### 3. Grid, loupe and filmstrip

| Check | Pass criterion |
|---|---|
| Grid | Thumbnails fill in progressively; sort by name and by capture time are correct |
| Filters | Stars, labels, flags and singles filter exactly the right pictures |
| Selection | Select many, apply a rating, label or flag in one step; all change, undo restores |
| Loupe | Opens on tap; swipe and edge taps page; pinch zooms; 100 % shows the original file |
| Filmstrip | Shows the neighbours, follows the current picture, tap jumps |
| RAW-only picture | Shows the embedded preview, or the placeholder from check 1 |
| Rotation | EXIF orientation is right in the grid and the loupe, in portrait and landscape |
| Series | Compare and the series viewer open for the burst and show the right frames |

### 4. Culling: flags and stars

| Check | Pass criterion |
|---|---|
| Stars, colour labels, Pick, Reject | Set by buttons, swipe gestures and keys; the picture shows the new value at once |
| Undo and redo | Each step reverts and repeats exactly |
| Persistence | Reload the page and the decisions are still there |
| Resume | Close the tab mid-cull; reopening the same folder set resumes at the same place |
| Review rejects | The list holds exactly the rejected pictures; rescuing one removes it |
| Delete | After the summary, every file of the rejects (JPEG, RAW, sidecars) is in the Nextcloud trash |
| Restore | Restoring from the trash brings each file back to its path |
| *Remove RAWs* | Only the RAW and its own `<raw>.xmp` go to the trash; JPEG and decisions stay |
| Partial failure | Make one file unreadable (read-only share): the report names the file, the others are handled and the state is traceable |

### 5. Move with rename

| Check | Pass criterion |
|---|---|
| Move dialog | Previews the plan with the user's name template ([`05-name-templates.md`](../05-name-templates.md)) |
| Move | Every file of a picture arrives under the new name; sidecars move after their members |
| Collision | The existing name is reported and nothing is overwritten |
| Missing target folder | It is created |
| Failure midway | Revoke write access on the target mid-run: files already moved go back, last first, and the report says so |
| Sync | A desktop sync client on a **test** account shows renames, not delete plus upload where Nextcloud can tell |

### 6. XMP interop

| Check | Pass criterion |
|---|---|
| Read | Ratings, flags and labels written by digiKam, darktable and Lightroom Classic appear in the grid; precedence follows [`06-xmp-interop.md`](../06-xmp-interop.md#reading) |
| Write | *Write decisions to sidecars…* creates or updates the sidecars named by the rules ([Writing](../06-xmp-interop.md#writing)) |
| Round trip | Open the written sidecars in digiKam, darktable and Lightroom Classic (on a copy): rating, label and flag match |
| Foreign fields | A sidecar's other fields (history, crop, keywords) survive a write unchanged |
| Shared `<base>.xmp` | Read, written and removed per the sidecar rules |
| Read-only share | Writing is refused with a per-file message; the files are unchanged |
| Checked save | Change a sidecar elsewhere between read and write: the write is refused, not merged blindly |

### 7. Per-user state

| Check | Pass criterion |
|---|---|
| Settings | `owner-test` changes file types, layout, gestures and keys; `second-test` is unaffected |
| View state | Info panel and gesture guide state follow `owner-test` from desktop to iPad (LOUPE-003) |
| Device-bound state | Info panel width and navigation toggle stay per browser, as specified |
| Decisions per user | The same shared folder holds separate decisions for `owner-test` and `second-test` |
| Isolation | No user sees another user's settings, decisions or resume position |

### 8. Reference devices

Run grid, loupe, move dialog, delete summary and settings on every row of
[Reference devices](../plan.md#reference-devices), in portrait and landscape. Real hardware is
needed at least for the owner's **iPad** and **iPhone or Pixel**; the other rows are checked in
the browser's device emulation.

| Check | Pass criterion |
|---|---|
| Fits | Nothing clipped, no horizontal scroll, also after a rotation |
| Safe areas | No control under the camera, status bar or home indicator |
| Touch targets | At least 44 × 44 px on a coarse pointer; *Pick* and *Reject* reachable without moving the grip |
| Touch feel | No hover-only interaction; swipe, pinch and edge taps work with the hand, not only in emulation |
| Dark and light theme | Colours come from Nextcloud's variables; both themes are readable |
| Safari | iPadOS Safari with a trackpad and without; no dropped gestures |

### 9. Performance budget (24 MP)

Use real 24 MP JPEGs and RAW previews on the test server, on the LAN, with the iPad as the
client. Budgets are in [Image delivery](../plan.md#image-delivery--performance).

| Check | Pass criterion |
|---|---|
| Prefetched next loupe image | < 100 ms from the page to the sharp picture, no image request after the key press |
| First sharp image in a new folder | < 500 ms |
| Grid scroll at 2,000+ items | No visible jank, memory of the tab stays stable over a long scroll |
| Preview cold and warm | Record cold (no previews) and warm (Preview Generator done) numbers |
| Server load | Note CPU and memory of the web and database processes while previews generate |
| Tiers | Check the `512` and `2048` tiers that Nextcloud delivers at up to 1024 and 4096 px (ADR 0010) |

Run the automated measurement too, against the test server or locally with the cleaned photos:
`HONEYCOMB_BUDGET_PHOTOS=<folder> npx playwright test tests/e2e/loupe-budget.spec.ts`.
Write the numbers into the finding for the `TODO.md` item "Measure the image budgets"
(IMAGES-001.12).

### 10. Upgrade and uninstall

| Check | Pass criterion |
|---|---|
| Update to a newer build | Install a second build over the first: `occ app:update` or a replaced folder plus `occ upgrade`; settings, decisions and view state survive |
| Disable and enable | Data is kept and the app works as before |
| Remove | `occ app:remove honeycomb` leaves no PHP errors; the photos and sidecars are untouched |
| Data left behind | List what stays in the database and app config; note it as a finding if it is not documented |
| Trash after removal | Files deleted through honeycomb are still in the trash bin and can be restored |

## What happens after

1. Each failed item becomes a line in `TODO.md` (`/todo`) or, for a larger or owner-dependent
   matter, a GitHub issue labelled `needs-owner`. Each names the check, the build and the device.
2. Numbers from the performance run go into the budget `TODO.md` item and, once measured, into
   `docs/plan.md` and IMAGES-001.12.
3. A defect found here is fixed test first, with its spec updated, as any change
   ([`02-workflow.md`](../02-workflow.md)). Where the failure was something CI could have
   caught, add that check to the e2e suite.
4. When the checklist passes, or the open findings are accepted by the owner, the **Transifex**
   work starts ([Translations](../plan.md#translations), ADR 0007). The signing certificate and
   the App Store release stay separate `TODO.md` items.
5. Delete the test Nextcloud and the cleaned copies ([Teardown](#teardown)).

## Open owner decisions

1. Where the throwaway Nextcloud runs: a VM or container on a machine other than the production
   server, or a short-lived container on the owner's laptop.
2. Whether production is ever an option, and if so, after which checklist items pass.
3. Which and how many photos go into the test set, and who checks the cleaned copies for
   recognisable people.
4. Whether a desktop sync client test (move and rename propagation) is wanted.
5. Whether digiKam, darktable and Lightroom Classic are all available for the XMP round trip.
6. Which real devices are tested besides the iPad.
7. Whether the test is repeated for each later release, which would make a scripted setup
   worth a `TODO.md` item.
