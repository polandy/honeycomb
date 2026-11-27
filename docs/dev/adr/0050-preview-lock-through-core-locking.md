# 0050 – The preview lock through core's locking

- Status: accepted
- Date: 2026-11-22, retry amended 2026-11-27
- Replaces: the System V semaphore of 2026-11-20 in [`decisions.md`](../decisions.md) (IMAGES-001.18)

## Context

Nextcloud 35 rewrites a preview file in place when two requests render it at once, and a request
reading it meanwhile serves it empty. Since 2026-11-20 honeycomb renders a file's previews in one
request at a time, under a System V semaphore per file (`SemaphorePreviewLock`, 256 keys from
`0x48594300`). The isolation check of 2026-11-22 (T5) found two faults:

- The semaphores are kernel objects that outlive the app: nothing removes them, and an admin
  removing honeycomb has to free them by hand with `ipcrm` or a restart.
- The lock needs the `sysvsem` extension, works on one server only, and a waiter waits forever.

The options were:

- **A, core's file locking (`OCP\Lock\ILockingProvider`)**, chosen. Every instance has it: Redis
  or APCu where `memcache.locking` is set, else the table `oc_file_locks`. Core releases a
  request's locks when the request ends, also after a fatal error, and expires a lock left by a
  killed process after `filelocking.ttl`. It locks across servers that share the cache or database.
- **B, an `IMemcache` lock of our own** (`ICacheFactory::createLocking`, `add` and `cad`). It
  takes its own expiry, but without `memcache.locking` it is a null cache and locks nothing, and
  a lock is not released when the request ends.
- **C, keep the semaphores and remove them on disable.** A disable hook cannot reach the
  semaphores of other servers, and the lock stays tied to `sysvsem` and one server.

## Decision

- `CorePreviewLock` takes an exclusive core lock on the key `honeycomb/preview/<fileId>` while
  `$render` runs, and releases it in `finally`.
- Core's locks do not wait: a locked key throws `LockedException`. The lock tries again every
  50 ms through the injected `Pause`, 600 times, so for at most 30 s (`WAIT_SECONDS`).
- After 30 s it renders without the lock and logs a warning: the holder is stuck or was killed,
  and an empty tile is better than none. A lock it did not take is never released.
- With `filelocking.enabled` off core locks nothing, and the renders run unlocked, as core's own
  previews do.

## Consequences

- honeycomb leaves nothing in the kernel; `removing.md` loses its semaphore step. A lock row in
  `oc_file_locks` is core's, removed when the request ends or expires.
- No PHP extension is needed for the lock.
- A tile that meets a lock waits at most 50 ms longer than the render. Contention is common, not
  rare: the warm-up renders the files in the grid's order, the order the tiles load. Until the
  amendment of 2026-11-27 the lock tried again once a second, and the first sharp tile of a
  folder whose previews were rendered took over the 1000 ms budget on CI (IMAGES-001.12).
- Tests drive `LockedException` and the clock through fakes; they never sleep.
