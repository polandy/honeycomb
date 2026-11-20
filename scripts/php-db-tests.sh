#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Runs the tests of tests/php-db inside a fresh Nextcloud, the newest e2e image, with this checkout as the app.
# HONEYCOMB_DB picks the database: sqlite (default), mariadb or postgres (scripts/database.sh).
set -euo pipefail
cd "$(dirname "$0")/.." || exit 1

source scripts/nextcloud-images.sh
source scripts/e2e-names.sh
source scripts/database.sh

run_id=$$
trap 'database_stop "$run_id"' EXIT
database_start "$run_id"

docker run --rm --label "$(e2e_owner_label)" "${DATABASE_DOCKER_ARGS[@]}" -e NEXTCLOUD_ADMIN_USER=admin -e NEXTCLOUD_ADMIN_PASSWORD=admin \
  -e NEXTCLOUD_UPDATE=1 -v "$PWD:/var/www/html/custom_apps/honeycomb:ro" "$NEWEST_NEXTCLOUD_IMAGE" \
  sh -c '/entrypoint.sh true && su -s /bin/sh www-data -c "php occ app:enable honeycomb && cd custom_apps/honeycomb && php vendor/bin/phpunit -c phpunit-db.xml"'
