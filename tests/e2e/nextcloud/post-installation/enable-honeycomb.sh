#!/bin/sh
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Runs inside the e2e container once Nextcloud is installed, before it serves requests.
set -eu
php /var/www/html/occ app:disable firstrunwizard
php /var/www/html/occ app:enable honeycomb
# Team folders and local External Storage, for the trash bin on other storages.
php /var/www/html/occ app:enable groupfolders files_external
mkdir -p /tmp/honeycomb-e2e-external
# A mount a test adds through occ shows up at once, not after the 5-minute mount cache.
php /var/www/html/occ config:system:set fs_mount_cache_duration --type=integer --value=0
# Server errors go to the container's output, which Playwright prints, so a red e2e run shows its cause.
php /var/www/html/occ config:system:set log_type --value=errorlog
