#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Test for scripts/verify-steps.sh: result lines carry the duration, a failing step shows its output,
# parallel steps run at once and still print in start order, the e2e slot is taken host-wide.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

work=$(mktemp -d)
trap 'rm -rf "${work:?}"' EXIT

# A fake clock: each reading returns the next second from the list, so no test waits.
cat >"$work/clock.sh" <<'CLOCK'
#!/usr/bin/env bash
ticks=$1
read -r now <"$ticks"
echo $((now + 1)) >"$ticks"
case $now in
  0) echo 100 ;; 1) echo 100 ;; 2) echo 107 ;; 3) echo 107 ;; 4) echo 109 ;; 5) echo 150 ;; *) echo 200 ;;
esac
CLOCK
chmod +x "$work/clock.sh"
echo 0 >"$work/ticks"

got=$(
  VERIFY_CLOCK="$work/clock.sh $work/ticks"
  export VERIFY_CLOCK
  source scripts/verify-steps.sh
  step good true
  step bad sh -c 'echo boom-output; exit 1'
  verify_total
  exit $failed
)
status=$?

failed=0
expect() {
  if ! grep -qxF -- "$1" <<<"$got"; then
    echo "FAIL missing line '$1' in:"
    echo "$got"
    failed=1
  fi
}

expect "ok   good (7s)"
expect "FAIL bad (2s)"
expect "boom-output"
expect "total 50s"
if [ "$status" -ne 1 ]; then
  echo "FAIL a failing step must make the caller exit 1, got $status"
  failed=1
fi

# The first step passes only if the second runs at the same time; the hang guard fails a sequential run.
mkfifo "$work/handoff"
parallel_got=$(
  VERIFY_CLOCK="echo 0"
  export VERIFY_CLOCK
  source scripts/verify-steps.sh
  parallel_step waits timeout 30 cat "$work/handoff"
  parallel_step hands timeout 30 sh -c "echo handed >'$work/handoff'"
  parallel_step broken sh -c 'echo broken-output; exit 3'
  parallel_wait
  step after true
  exit $failed
)
parallel_status=$?
parallel_want="ok   waits (0s)
ok   hands (0s)
FAIL broken (0s)
broken-output
ok   after (0s)"
if [ "$parallel_got" != "$parallel_want" ]; then
  echo "FAIL parallel steps must print in start order with the failing output; got:"
  echo "$parallel_got"
  failed=1
fi
if [ "$parallel_status" -ne 1 ]; then
  echo "FAIL a failing parallel step must make the caller exit 1, got $parallel_status"
  failed=1
fi

# A free e2e slot is taken silently and held until released.
export HONEYCOMB_E2E_LOCK="$work/e2e.lock"
free_got=$(
  VERIFY_CLOCK="echo 0"
  source scripts/verify-steps.sh
  e2e_slot_take
  flock -n "$HONEYCOMB_E2E_LOCK" true && echo "slot not held"
  e2e_slot_release
  flock -n "$HONEYCOMB_E2E_LOCK" true || echo "slot not released"
)
if [ -n "$free_got" ]; then
  echo "FAIL a free e2e slot must be taken silently and released; got:"
  echo "$free_got"
  failed=1
fi

# A busy slot prints the wait and its duration; the waiter goes on only after the holder lets go.
echo 0 >"$work/ticks"
cat >"$work/step-clock.sh" <<'CLOCK'
#!/usr/bin/env bash
read -r now <"$1"
echo $((now + 1)) >"$1"
echo $((now * 4))
CLOCK
chmod +x "$work/step-clock.sh"
mkfifo "$work/waiter"
exec 8>"$HONEYCOMB_E2E_LOCK"
flock 8
(
  VERIFY_CLOCK="$work/step-clock.sh $work/ticks"
  source scripts/verify-steps.sh
  e2e_slot_take
  cat "$work/released" 2>/dev/null || echo "went on while held"
) >"$work/waiter" &
waiter=$!
exec 7<"$work/waiter"
read -r waiting <&7
echo released >"$work/released"
flock -u 8
busy_got="$waiting
$(cat <&7)"
exec 7<&- 8>&-
wait "$waiter"
busy_want="waiting for the e2e slot ($HONEYCOMB_E2E_LOCK)
got the e2e slot after 4s
released"
if [ "$busy_got" != "$busy_want" ]; then
  echo "FAIL a busy e2e slot must be waited for with its duration; got:"
  echo "$busy_got"
  failed=1
fi

exit $failed
