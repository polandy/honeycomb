#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Sourced by scripts/php-db-tests.sh: the database of one Nextcloud container.
# HONEYCOMB_DB picks the engine: sqlite (default), mariadb or postgres.
MARIADB_IMAGE=mariadb:11.4@sha256:a8992b5e5404d11e03c54a31d0c1bdea3fd116d283aa6d1a627551f29045309b
POSTGRES_IMAGE=postgres:17@sha256:b60e90042aa6b8dbecd58e224b3e36114dbf8ad754465264c2476ad58a86e45c
DATABASE_NAME=nextcloud
DATABASE_PASSWORD=nextcloud
DATABASE_START_SECONDS=120

database_engine() { echo "${HONEYCOMB_DB:-sqlite}"; }
database_container() { echo "honeycomb-db-$1"; }

# Runs the database container <id> on its own network until it reports healthy; DATABASE_COMMAND follows the image.
database_run() {
  local id=$1 image=$2 health=$3
  shift 3
  local name tries
  name=$(database_container "$id")
  docker network create "$name" >/dev/null || return 1
  docker run --detach --name "$name" --network "$name" --label "$(e2e_owner_label)" \
    --health-cmd "$health" --health-interval 2s "$@" "$image" "${DATABASE_COMMAND[@]}" >/dev/null || return 1
  for ((tries = 0; tries < DATABASE_START_SECONDS; tries++)); do
    [ "$(docker inspect --format '{{.State.Health.Status}}' "$name")" = healthy ] && return 0
    sleep 1
  done
  echo "the $(database_engine) database did not become healthy within $DATABASE_START_SECONDS seconds" >&2
  return 1
}

# Starts the database for run <id>; DATABASE_DOCKER_ARGS then holds what the Nextcloud container needs.
database_start() {
  local id=$1 name
  name=$(database_container "$id")
  case "$(database_engine)" in
    sqlite) DATABASE_DOCKER_ARGS=(-e "SQLITE_DATABASE=$DATABASE_NAME") ;;
    mariadb)
      DATABASE_COMMAND=(--transaction-isolation=READ-COMMITTED)
      database_run "$id" "$MARIADB_IMAGE" 'healthcheck.sh --connect --innodb_initialized' \
        -e "MARIADB_DATABASE=$DATABASE_NAME" -e "MARIADB_USER=$DATABASE_NAME" \
        -e "MARIADB_PASSWORD=$DATABASE_PASSWORD" -e MARIADB_RANDOM_ROOT_PASSWORD=1 || return 1
      DATABASE_DOCKER_ARGS=(--network "$name" -e "MYSQL_HOST=$name" -e "MYSQL_DATABASE=$DATABASE_NAME" \
        -e "MYSQL_USER=$DATABASE_NAME" -e "MYSQL_PASSWORD=$DATABASE_PASSWORD")
      ;;
    postgres)
      DATABASE_COMMAND=()
      database_run "$id" "$POSTGRES_IMAGE" "pg_isready -h 127.0.0.1 -U $DATABASE_NAME" \
        -e "POSTGRES_DB=$DATABASE_NAME" -e "POSTGRES_USER=$DATABASE_NAME" \
        -e "POSTGRES_PASSWORD=$DATABASE_PASSWORD" || return 1
      DATABASE_DOCKER_ARGS=(--network "$name" -e "POSTGRES_HOST=$name" -e "POSTGRES_DB=$DATABASE_NAME" \
        -e "POSTGRES_USER=$DATABASE_NAME" -e "POSTGRES_PASSWORD=$DATABASE_PASSWORD")
      ;;
    *)
      echo "unknown HONEYCOMB_DB '$(database_engine)'; use sqlite, mariadb or postgres" >&2
      return 1
      ;;
  esac
}

# Removes the database container and network of run <id>; a run on SQLite has none.
database_stop() {
  [ "$(database_engine)" = sqlite ] && return 0
  docker rm --force "$(database_container "$1")" >/dev/null 2>&1 || true
  docker network rm "$(database_container "$1")" >/dev/null 2>&1 || true
}
