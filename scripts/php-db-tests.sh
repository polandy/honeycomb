#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Runs the mapper tests (tests/php-db) inside a fresh Nextcloud on SQLite, the e2e image, with this checkout as the app.
set -euo pipefail
cd "$(dirname "$0")/.." || exit 1

NEXTCLOUD_IMAGE=nextcloud:35.0.2-apache@sha256:786c102155d2717ba0f53a62b3fdd7a1354edc48e800b94dbe32294d9a5752a2

exec docker run --rm -e SQLITE_DATABASE=nextcloud -e NEXTCLOUD_ADMIN_USER=admin -e NEXTCLOUD_ADMIN_PASSWORD=admin \
  -e NEXTCLOUD_UPDATE=1 -v "$PWD:/var/www/html/custom_apps/honeycomb:ro" "$NEXTCLOUD_IMAGE" \
  sh -c '/entrypoint.sh true && su -s /bin/sh www-data -c "php occ app:enable honeycomb && cd custom_apps/honeycomb && php vendor/bin/phpunit -c phpunit-db.xml"'
