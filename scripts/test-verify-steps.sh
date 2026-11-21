#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Test for scripts/verify-steps.sh: result lines carry the duration, a failing step shows its output,
# parallel steps run at once and still print in start order, the e2e slot is taken host-wide, steps
# never inherit it, busy ports are passed over and only orphaned own containers are removed.
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

# A step's children never hold the e2e slot, so an orphaned child cannot block the next run.
inherit_got=$(
  VERIFY_CLOCK="echo 0"
  source scripts/verify-steps.sh
  e2e_slot_take
  step "fd 9 closed" sh -c 'if true >&9; then echo "fd 9 inherited"; exit 1; fi'
  parallel_step "fd 9 closed in parallel" sh -c 'if true >&9; then echo "fd 9 inherited"; exit 1; fi'
  parallel_wait
  e2e_slot_release
)
inherit_want="ok   fd 9 closed (0s)
ok   fd 9 closed in parallel (0s)"
if [ "$inherit_got" != "$inherit_want" ]; then
  echo "FAIL steps must not inherit the e2e slot's fd 9; got:"
  echo "$inherit_got"
  failed=1
fi

# Fakes: docker records its arguments and lists $DOCKER_CONTAINERS, the others answer from a list.
host=$(uname -n)
mkdir "$work/bin"
cat >"$work/bin/docker" <<'STUB'
#!/usr/bin/env bash
echo "$*" >>"$DOCKER_LOG"
if [ "$1" = ps ]; then cat "$DOCKER_CONTAINERS"; fi
STUB
cat >"$work/alive.sh" <<'STUB'
#!/usr/bin/env bash
grep -qxF -- "$1" "$ALIVE_PIDS"
STUB
cat >"$work/busy.sh" <<'STUB'
#!/usr/bin/env bash
echo "$1" >>"$PORT_CHECKS"
grep -qxF -- "$1" "$BUSY_PORTS"
STUB
chmod +x "$work/bin/docker" "$work/alive.sh" "$work/busy.sh"
printf '%s\n' "dead1 41@$host" "live1 42@$host" "bare1 " "away1 41@elsewhere" "mine1 43@$host" >"$work/containers"
printf '%s\n' 42 43 >"$work/alive"
export PATH="$work/bin:$PATH" DOCKER_CONTAINERS="$work/containers" ALIVE_PIDS="$work/alive" \
  VERIFY_PROCESS_ALIVE="$work/alive.sh" VERIFY_PORT_BUSY="$work/busy.sh" HONEYCOMB_E2E_OWNER="43@$host"
removed() { grep '^rm ' "$work/$1.log"; }

# Only a labelled container on this host whose owner is gone is removed; a live owner, another host
# and a container without the label stay.
reap_got=$(DOCKER_LOG="$work/reap.log" bash -c 'source scripts/e2e-names.sh; source scripts/verify-steps.sh; e2e_reap_orphans')
if [ "$(removed reap)" != "rm --force dead1" ] || [ "$reap_got" != "removed the orphaned e2e container dead1 (owner 41@$host)" ]; then
  echo "FAIL only the orphan dead1 must be removed; got '$reap_got' and:"
  cat "$work/reap.log"
  failed=1
fi

# This run's own containers go at a normal end and on an abort alike.
for end in "exit 0" "kill -TERM \$BASHPID"; do
  : >"$work/end.log"
  DOCKER_LOG="$work/end.log" bash -c "source scripts/e2e-names.sh; source scripts/verify-steps.sh; e2e_remove_on_exit; $end"
  if [ "$(removed end)" != "rm --force mine1" ]; then
    echo "FAIL '$end' must remove only this run's container mine1; got:"
    cat "$work/end.log"
    failed=1
  fi
done

# A busy port is passed over at once: each port is asked once, the next free one is taken, and the
# two runs never share a port.
choose() {
  : >"$work/checks"
  printf '%s\n' "$@" >"$work/busy-ports"
  PORT_CHECKS="$work/checks" BUSY_PORTS="$work/busy-ports" timeout 30 env -u HONEYCOMB_E2E_PORT \
    -u HONEYCOMB_E2E_OLDEST_PORT bash -c 'source scripts/e2e-names.sh
      source scripts/verify-steps.sh
      e2e_ports_choose 2>/dev/null || exit 1
      echo "$HONEYCOMB_E2E_PORT $HONEYCOMB_E2E_OLDEST_PORT"'
}
expect_ports() {
  local want=$1 checks=$2 got
  shift 2
  got=$(choose "$@")
  if [ "$got" != "$want" ] || [ "$(paste -sd' ' "$work/checks")" != "$checks" ]; then
    echo "FAIL busy ports $* must give '$want' after checking '$checks'; got '$got' after:"
    paste -sd' ' "$work/checks"
    failed=1
  fi
}
expect_ports "8180 9180" "8180 9180"
expect_ports "8182 9182" "8180 8181 8182 9182" 8180 8181
expect_ports "8190 9190" "$(seq -s' ' 8180 8190) 9190" $(seq 8180 8189)
if choose $(seq 8180 8279) >/dev/null; then
  echo "FAIL no free port in the search range must fail the choice"
  failed=1
fi

exit $failed
