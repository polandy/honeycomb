#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Runs every CI check locally: one line per step, the full output of a failing step only.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

MARKDOWNLINT_CLI2_VERSION=0.24.0 # matches DavidAnson/markdownlint-cli2-action v25.0.0 in ci.yml
REUSE_VERSION=6.3.0              # matches the fsfe/reuse:6 image of fsfe/reuse-action v6.0.0

failed=0
step() {
  local name=$1
  shift
  local log
  log=$(mktemp)
  if "$@" >"$log" 2>&1; then
    echo "ok   $name"
  else
    echo "FAIL $name"
    cat "$log"
    failed=1
  fi
  rm -f "$log"
}

step markdownlint npx --yes "markdownlint-cli2@$MARKDOWNLINT_CLI2_VERSION"
step reuse uvx --from "reuse==$REUSE_VERSION" reuse lint

exit $failed
