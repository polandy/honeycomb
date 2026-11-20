#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Test for scripts/database.sh: each engine gives Nextcloud its own settings, a labelled and removable database.
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

# The stub records every call and answers a health check as healthy.
mkdir "$work/bin"
cat >"$work/bin/docker" <<'STUB'
#!/bin/sh
echo "$*" >>"$DOCKER_LOG"
[ "$1" = inspect ] && echo healthy
exit 0
STUB
chmod +x "$work/bin/docker"

# Runs database_start and database_stop of ENGINE for run 8190; prints the Nextcloud arguments.
run() {
  : >"$work/docker.log"
  PATH="$work/bin:$PATH" DOCKER_LOG="$work/docker.log" HONEYCOMB_DB="$1" HONEYCOMB_E2E_OWNER="7@test-host" \
    bash -c 'source scripts/database.sh; database_start 8190 && echo "${DATABASE_DOCKER_ARGS[*]}"; database_stop 8190'
}
calls() { grep -c -- "$1" "$work/docker.log"; }

check sqlite-args "-e SQLITE_DATABASE=nextcloud" "$(run sqlite)"
check sqlite-no-docker 0 "$(calls .)"
check default-is-sqlite "-e SQLITE_DATABASE=nextcloud" "$(env -u HONEYCOMB_DB PATH="$work/bin:$PATH" DOCKER_LOG="$work/docker.log" bash -c 'source scripts/database.sh; database_start 8190 && echo "${DATABASE_DOCKER_ARGS[*]}"')"

mariadb_args=$(run mariadb)
check mariadb-host 1 "$(grep -c -- '-e MYSQL_HOST=honeycomb-db-8190 ' <<<"$mariadb_args ")"
check mariadb-database 1 "$(grep -c -- '-e MYSQL_DATABASE=nextcloud' <<<"$mariadb_args")"
check mariadb-network 1 "$(grep -c -- '--network honeycomb-db-8190' <<<"$mariadb_args")"
check mariadb-no-sqlite 0 "$(grep -c SQLITE <<<"$mariadb_args")"
check mariadb-network-created 1 "$(calls '^network create honeycomb-db-8190')"
check mariadb-image-pinned 1 "$(calls "mariadb:.*@sha256:")"
check mariadb-labelled 1 "$(calls -- '--label honeycomb.e2e.owner=7@test-host')"
check mariadb-waits-healthy 1 "$(calls '^inspect')"
check mariadb-removed 1 "$(calls '^rm --force honeycomb-db-8190')"
check mariadb-network-removed 1 "$(calls '^network rm honeycomb-db-8190')"

postgres_args=$(run postgres)
check postgres-host 1 "$(grep -c -- '-e POSTGRES_HOST=honeycomb-db-8190 ' <<<"$postgres_args ")"
check postgres-database 1 "$(grep -c -- '-e POSTGRES_DB=nextcloud' <<<"$postgres_args")"
check postgres-image-pinned 1 "$(calls "postgres:.*@sha256:")"
check postgres-removed 1 "$(calls '^rm --force honeycomb-db-8190')"

check unknown-engine-fails 1 "$(PATH="$work/bin:$PATH" HONEYCOMB_DB=oracle bash -c 'source scripts/database.sh; database_start 8190' >/dev/null 2>&1 && echo 0 || echo 1)"

exit $failed
