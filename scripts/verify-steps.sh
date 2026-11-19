#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Sourced by verify.sh: step runs one command and prints its result line with the duration.
# VERIFY_CLOCK is the command that prints the current second; tests replace it.

VERIFY_CLOCK=${VERIFY_CLOCK:-"date +%s"}
failed=0
verify_start=$($VERIFY_CLOCK)

step() {
  local name=$1 log began ended
  shift
  log=$(mktemp)
  began=$($VERIFY_CLOCK)
  if "$@" >"$log" 2>&1; then
    ended=$($VERIFY_CLOCK)
    echo "ok   $name ($((ended - began))s)"
  else
    ended=$($VERIFY_CLOCK)
    echo "FAIL $name ($((ended - began))s)"
    cat "$log"
    failed=1
  fi
  rm -f "$log"
}

# Prints the total duration; the caller exits with $failed.
verify_total() {
  echo "total $(($($VERIFY_CLOCK) - verify_start))s"
}
