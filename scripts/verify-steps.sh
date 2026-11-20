#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Sourced by verify.sh: step runs one command and prints its result line with the duration;
# parallel_step starts one in the background and parallel_wait prints those lines in start order;
# e2e_slot_take and e2e_slot_release bracket the Nextcloud containers with a host-wide lock.
# VERIFY_CLOCK is the command that prints the current second; tests replace it.

VERIFY_CLOCK=${VERIFY_CLOCK:-"date +%s"}
failed=0
verify_start=$($VERIFY_CLOCK)
parallel_pids=()
parallel_logs=()

# Prints the result line, and the full output on failure; returns 1 when the command fails.
run_step() {
  local name=$1 log began ended status=0
  shift
  log=$(mktemp)
  began=$($VERIFY_CLOCK)
  "$@" >"$log" 2>&1 || status=1
  ended=$($VERIFY_CLOCK)
  if [ "$status" -eq 0 ]; then
    echo "ok   $name ($((ended - began))s)"
  else
    echo "FAIL $name ($((ended - began))s)"
    cat "$log"
  fi
  rm -f "$log"
  return "$status"
}

step() {
  run_step "$@" || failed=1
}

parallel_step() {
  local out
  out=$(mktemp)
  run_step "$@" >"$out" 2>&1 &
  parallel_pids+=($!)
  parallel_logs+=("$out")
}

# Waits for every parallel step and prints their results in the order they started.
parallel_wait() {
  local i
  for i in "${!parallel_pids[@]}"; do
    wait "${parallel_pids[$i]}" || failed=1
    cat "${parallel_logs[$i]}"
    rm -f "${parallel_logs[$i]}"
  done
  parallel_pids=()
  parallel_logs=()
}

# Takes the host-wide e2e slot on fd 9 (HONEYCOMB_E2E_LOCK) and prints how long it waited when busy.
e2e_slot_take() {
  local lock=${HONEYCOMB_E2E_LOCK:-/tmp/honeycomb-e2e.lock} began
  exec 9>>"$lock" || return 1
  flock -n 9 && return 0
  echo "waiting for the e2e slot ($lock)"
  began=$($VERIFY_CLOCK)
  flock 9 || return 1
  echo "got the e2e slot after $(($($VERIFY_CLOCK) - began))s"
}

# Unlocks explicitly, since the steps' children inherit fd 9.
e2e_slot_release() {
  flock -u 9
  exec 9>&-
}

# Prints the total duration; the caller exits with $failed.
verify_total() {
  echo "total $(($($VERIFY_CLOCK) - verify_start))s"
}
