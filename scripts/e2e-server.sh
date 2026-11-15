#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Runs a fresh Nextcloud with this checkout as the honeycomb app, in the foreground for Playwright.
# Usage: scripts/e2e-server.sh <port> <admin user> <admin password>
set -euo pipefail
cd "$(dirname "$0")/.." || exit 1

NEXTCLOUD_IMAGE=nextcloud:35.0.2-apache@sha256:786c102155d2717ba0f53a62b3fdd7a1354edc48e800b94dbe32294d9a5752a2
CONTAINER=honeycomb-e2e-$1
TEAM_FOLDERS_VERSION=23.0.1
TEAM_FOLDERS_SHA256=3949e6a45947188090c170c6983aae11a1d66134ec317ffe7b7609062f3aecf3
TEAM_FOLDERS="${XDG_CACHE_HOME:-$HOME/.cache}/honeycomb-e2e/groupfolders-$TEAM_FOLDERS_VERSION"

# Team folders is no bundled app; fetch the pinned release once, check it every run (ADR 0030).
if [ ! -f "$TEAM_FOLDERS.tar.gz" ]; then
  mkdir -p "$(dirname "$TEAM_FOLDERS")"
  curl -fsSL -o "$TEAM_FOLDERS.tar.gz.part" \
    "https://github.com/nextcloud-releases/groupfolders/releases/download/v$TEAM_FOLDERS_VERSION/groupfolders-v$TEAM_FOLDERS_VERSION.tar.gz"
  mv "$TEAM_FOLDERS.tar.gz.part" "$TEAM_FOLDERS.tar.gz"
fi
echo "$TEAM_FOLDERS_SHA256  $TEAM_FOLDERS.tar.gz" | sha256sum --check --quiet
if [ ! -d "$TEAM_FOLDERS" ]; then
  rm -rf "${TEAM_FOLDERS:?}.part" && mkdir "$TEAM_FOLDERS.part"
  tar -xzf "$TEAM_FOLDERS.tar.gz" -C "$TEAM_FOLDERS.part" --strip-components=1
  mv "$TEAM_FOLDERS.part" "$TEAM_FOLDERS"
fi

docker rm --force "$CONTAINER" >/dev/null 2>&1 || true
exec docker run --rm --name "$CONTAINER" -p "127.0.0.1:$1:80" \
  -e SQLITE_DATABASE=nextcloud -e NEXTCLOUD_ADMIN_USER="$2" -e NEXTCLOUD_ADMIN_PASSWORD="$3" \
  -v "$PWD:/var/www/html/custom_apps/honeycomb:ro" \
  -v "$TEAM_FOLDERS:/var/www/html/custom_apps/groupfolders:ro" \
  -v "$PWD/tests/e2e/nextcloud/post-installation:/docker-entrypoint-hooks.d/post-installation:ro" \
  "$NEXTCLOUD_IMAGE"
