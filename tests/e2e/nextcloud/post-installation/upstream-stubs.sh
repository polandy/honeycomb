#!/bin/sh
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Runs after enable-honeycomb.sh: starts the upstream stubs inside the container and names the e2e connections file.
set -eu
APP=/var/www/html/custom_apps/honeycomb
# The stub outlives this hook; quiet, it logs only the calls it cannot answer.
PHP_CLI_SERVER_WORKERS=4 setsid php -q -S 127.0.0.1:2283 "$APP/tests/e2e/upstream/immich.php" &
php /var/www/html/occ config:app:set honeycomb connections_file --value="$APP/tests/fixtures/immich/e2e/connections.json"
