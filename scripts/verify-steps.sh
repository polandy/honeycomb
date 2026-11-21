#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Sourced by verify.sh: step runs one command and prints its result line with the duration;
# parallel_step starts one in the background and parallel_wait prints those lines in start order;
# e2e_slot_take and e2e_slot_release bracket the Nextcloud containers with a host-wide lock.
# The e2e_* container and port functions need scripts/e2e-names.sh sourced first.
# VERIFY_CLOCK prints the current second, VERIFY_PROCESS_ALIVE checks a pid and VERIFY_PORT_BUSY a
# port on localhost; tests replace them.

VERIFY_CLOCK=${VERIFY_CLOCK:-"date +%s"}
VERIFY_PROCESS_ALIVE=${VERIFY_PROCESS_ALIVE:-process_alive}
VERIFY_PORT_BUSY=${VERIFY_PORT_BUSY:-port_busy}
# The ports after the wanted one that a busy port may move to.
E2E_PORT_SEARCH=100
export HONEYCOMB_E2E_OWNER=${HONEYCOMB_E2E_OWNER:-$$@$(uname -n)}
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
  "$@" >"$log" 2>&1 9>&- || status=1
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

process_alive() { ps -p "$1" >/dev/null 2>&1; }

port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

# Prints "<id> <owner>" per container on the host; the owner is empty without the label.
e2e_labelled_containers() {
  docker ps --all --format "{{.ID}} {{.Label \"$E2E_OWNER_LABEL\"}}"
}

# Removes the labelled containers on this host whose owner process is gone; others are left alone.
e2e_reap_orphans() {
  local containers id owner host
  containers=$(e2e_labelled_containers) || return 1
  host=$(uname -n)
  while read -r id owner; do
    [ -n "$owner" ] && [ "${owner#*@}" = "$host" ] || continue
    $VERIFY_PROCESS_ALIVE "${owner%%@*}" && continue
    docker rm --force "$id" >/dev/null || return 1
    echo "removed the orphaned e2e container $id (owner $owner)"
  done <<<"$containers"
}

# Removes the containers this run owns.
e2e_remove_own() {
  local containers id owner
  containers=$(e2e_labelled_containers) || return 1
  while read -r id owner; do
    [ "$owner" = "$HONEYCOMB_E2E_OWNER" ] || continue
    docker rm --force "$id" >/dev/null
  done <<<"$containers"
}

# Removes this run's containers when the shell ends, by exit or by an aborting signal.
e2e_remove_on_exit() {
  trap e2e_remove_own EXIT
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM
}

# Prints the first port from $1 on that is free and not among the other arguments; never waits.
e2e_free_port() {
  local wanted=$1 port
  shift
  for ((port = wanted; port < wanted + E2E_PORT_SEARCH; port++)); do
    [[ " $* " == *" $port "* ]] && continue
    if ! $VERIFY_PORT_BUSY "$port"; then
      [ "$port" -eq "$wanted" ] || echo "port $wanted is busy, using $port" >&2
      echo "$port"
      return 0
    fi
  done
  echo "no free port from $wanted to $((wanted + E2E_PORT_SEARCH - 1))" >&2
  return 1
}

# Exports a free port each for the e2e, and the oldest-Nextcloud e2e.
e2e_ports_choose() {
  HONEYCOMB_E2E_PORT=$(e2e_free_port "$(e2e_port)") || return 1
  HONEYCOMB_E2E_OLDEST_PORT=$(e2e_free_port "$(e2e_oldest_port)" "$HONEYCOMB_E2E_PORT") || return 1
  export HONEYCOMB_E2E_PORT HONEYCOMB_E2E_OLDEST_PORT
}

# Prints the total duration; the caller exits with $failed.
verify_total() {
  echo "total $(($($VERIFY_CLOCK) - verify_start))s"
}
