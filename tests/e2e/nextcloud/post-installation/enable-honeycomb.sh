#!/bin/sh
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Runs inside the e2e container once Nextcloud is installed, before it serves requests.
set -eu
php /var/www/html/occ app:disable firstrunwizard
php /var/www/html/occ app:enable honeycomb
