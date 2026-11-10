#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Runs a fresh Nextcloud with this checkout as the honeycomb app, in the foreground for Playwright.
# Usage: scripts/e2e-server.sh <port> <admin user> <admin password>
set -euo pipefail
cd "$(dirname "$0")/.." || exit 1

NEXTCLOUD_IMAGE=nextcloud:35.0.2-apache@sha256:786c102155d2717ba0f53a62b3fdd7a1354edc48e800b94dbe32294d9a5752a2
CONTAINER=honeycomb-e2e

docker rm --force "$CONTAINER" >/dev/null 2>&1 || true
exec docker run --rm --name "$CONTAINER" -p "127.0.0.1:$1:80" \
  -e SQLITE_DATABASE=nextcloud -e NEXTCLOUD_ADMIN_USER="$2" -e NEXTCLOUD_ADMIN_PASSWORD="$3" \
  -v "$PWD:/var/www/html/custom_apps/honeycomb:ro" \
  -v "$PWD/tests/e2e/nextcloud/post-installation:/docker-entrypoint-hooks.d/post-installation:ro" \
  "$NEXTCLOUD_IMAGE"
