#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Test for scripts/php-db-tests.sh: it runs the PHP tests in the newest Nextcloud by default and in
# the oldest one when HONEYCOMB_DB_NEXTCLOUD says so; an unknown image fails before Docker runs.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
failed=0
check() {
  if [ "$2" != "$3" ]; then
    echo "FAIL $1: want '$2' got '$3'"
    failed=1
  fi
}

source scripts/nextcloud-images.sh

# Docker only records the run; SQLite needs no database container, so one stub is enough.
mkdir "$work/bin"
cat >"$work/bin/docker" <<'STUB'
#!/bin/sh
echo "$*" >>"$DOCKER_LOG"
[ "$1" = inspect ] && echo healthy
exit 0
STUB
chmod +x "$work/bin/docker"

# Runs php-db-tests.sh for IMAGE with the PHPUnit arguments and records the Docker calls.
run() {
  local image=$1
  shift
  : >"$work/docker.log"
  PATH="$work/bin:$PATH" DOCKER_LOG="$work/docker.log" HONEYCOMB_E2E_OWNER="7@test-host" \
    HONEYCOMB_DB_NEXTCLOUD="$image" scripts/php-db-tests.sh "$@" >/dev/null 2>&1
}
# The default is what runs without HONEYCOMB_DB_NEXTCLOUD in the environment.
run_default() {
  : >"$work/docker.log"
  env -u HONEYCOMB_DB_NEXTCLOUD PATH="$work/bin:$PATH" DOCKER_LOG="$work/docker.log" \
    HONEYCOMB_E2E_OWNER="7@test-host" scripts/php-db-tests.sh "$@" >/dev/null 2>&1
}
runs() { grep -cF -- "$1" "$work/docker.log"; }

run_default --group canary
check default-newest 1 "$(runs "$NEWEST_NEXTCLOUD_IMAGE")"
check default-not-oldest 0 "$(runs "$OLDEST_NEXTCLOUD_IMAGE")"
check default-passes-args 1 "$(runs "-e PHPUNIT_ARGS=--group canary")"

run newest --group canary
check newest-image 1 "$(runs "$NEWEST_NEXTCLOUD_IMAGE")"
check newest-not-oldest 0 "$(runs "$OLDEST_NEXTCLOUD_IMAGE")"

run oldest --group canary
check oldest-image 1 "$(runs "$OLDEST_NEXTCLOUD_IMAGE")"
check oldest-not-newest 0 "$(runs "$NEWEST_NEXTCLOUD_IMAGE")"

# An unknown image is refused by name before Docker runs.
: >"$work/docker.log"
if PATH="$work/bin:$PATH" DOCKER_LOG="$work/docker.log" HONEYCOMB_E2E_OWNER="7@test-host" \
    HONEYCOMB_DB_NEXTCLOUD=middle scripts/php-db-tests.sh >/dev/null 2>&1; then
  echo "FAIL an unknown HONEYCOMB_DB_NEXTCLOUD must fail"
  failed=1
fi
check unknown-no-docker 0 "$(wc -l <"$work/docker.log")"

exit $failed
