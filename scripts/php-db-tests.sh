#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Runs the tests of tests/php-db inside a fresh Nextcloud, with this checkout as the app.
# HONEYCOMB_DB picks the database: sqlite (default), mariadb or postgres (scripts/database.sh).
# HONEYCOMB_DB_NEXTCLOUD picks the image the full suite runs in: newest (default) or oldest.
# The FileCacheLibrary canary (ADR 0049) then runs in the other image too, so every Nextcloud
# version CI covers runs its raw oc_filecache queries.
# Arguments go to PHPUnit, e.g. `--group bench` for the measurements phpunit-db.xml leaves out.
set -euo pipefail
cd "$(dirname "$0")/.." || exit 1

source scripts/nextcloud-images.sh
source scripts/e2e-names.sh
source scripts/database.sh

SELECTED=${HONEYCOMB_DB_NEXTCLOUD:-newest}
case "$SELECTED" in
  oldest | newest) ;;
  *) echo "HONEYCOMB_DB_NEXTCLOUD must be oldest or newest" >&2 && exit 1 ;;
esac

run_id=$$
trap 'database_stop "$run_id"' EXIT
database_start "$run_id"

# Runs PHPUnit in a fresh container of IMAGE with the given arguments.
run_phpunit() {
  local image=$1
  shift
  docker run --rm --label "$(e2e_owner_label)" "${DATABASE_DOCKER_ARGS[@]}" -e NEXTCLOUD_ADMIN_USER=admin -e NEXTCLOUD_ADMIN_PASSWORD=admin \
    -e NEXTCLOUD_UPDATE=1 -e PHPUNIT_ARGS="$*" -v "$PWD:/var/www/html/custom_apps/honeycomb:ro" "$image" \
    sh -c '/entrypoint.sh true && su -s /bin/sh www-data -c "php occ app:enable honeycomb && cd custom_apps/honeycomb && php vendor/bin/phpunit -c phpunit-db.xml $PHPUNIT_ARGS"'
}

run_phpunit "$(e2e_nextcloud_image "$SELECTED")" "$@"

# The full suite already ran the canary in the selected image; the other one covers the rest (ADR 0049).
for version in oldest newest; do
  [ "$version" = "$SELECTED" ] && continue
  run_phpunit "$(e2e_nextcloud_image "$version")" --group canary
done
