#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Runs a fresh Nextcloud with this checkout as the honeycomb app, in the foreground for Playwright.
# Usage: scripts/e2e-server.sh <port> <admin user> <admin password>
# HONEYCOMB_E2E_NEXTCLOUD=oldest runs the oldest supported Nextcloud instead of the newest.
set -euo pipefail
cd "$(dirname "$0")/.." || exit 1

source scripts/nextcloud-images.sh
source scripts/e2e-names.sh
case "${HONEYCOMB_E2E_NEXTCLOUD:-newest}" in
  oldest) NEXTCLOUD=$OLDEST_NEXTCLOUD_IMAGE ;;
  newest) NEXTCLOUD=$NEWEST_NEXTCLOUD_IMAGE ;;
  *) echo "HONEYCOMB_E2E_NEXTCLOUD must be oldest or newest" >&2 && exit 1 ;;
esac
CONTAINER=$(e2e_container "$1")
TEAM_FOLDERS_VERSION=23.0.1
TEAM_FOLDERS_SHA256=3949e6a45947188090c170c6983aae11a1d66134ec317ffe7b7609062f3aecf3
TEAM_FOLDERS="${XDG_CACHE_HOME:-$HOME/.cache}/honeycomb-e2e/groupfolders-$TEAM_FOLDERS_VERSION"
# A CI runner's link to github.com drops now and then; retry a short connect instead of failing the run.
DOWNLOAD_ATTEMPTS=5
CONNECT_SECONDS=20

# Team folders is no bundled app; fetch the pinned release once, check it every run (ADR 0030).
# Parallel runs share the cache: the lock lets one fill it while the others wait.
mkdir -p "$(dirname "$TEAM_FOLDERS")"
(
  flock 9
  if [ ! -f "$TEAM_FOLDERS.tar.gz" ]; then
    curl -fsSL --connect-timeout "$CONNECT_SECONDS" --retry "$DOWNLOAD_ATTEMPTS" --retry-all-errors \
      -o "$TEAM_FOLDERS.tar.gz.part" \
      "https://github.com/nextcloud-releases/groupfolders/releases/download/v$TEAM_FOLDERS_VERSION/groupfolders-v$TEAM_FOLDERS_VERSION.tar.gz"
    mv "$TEAM_FOLDERS.tar.gz.part" "$TEAM_FOLDERS.tar.gz"
  fi
  echo "$TEAM_FOLDERS_SHA256  $TEAM_FOLDERS.tar.gz" | sha256sum --check --quiet
  if [ ! -d "$TEAM_FOLDERS" ]; then
    rm -rf "${TEAM_FOLDERS:?}.part" && mkdir "$TEAM_FOLDERS.part"
    tar -xzf "$TEAM_FOLDERS.tar.gz" -C "$TEAM_FOLDERS.part" --strip-components=1
    mv "$TEAM_FOLDERS.part" "$TEAM_FOLDERS"
  fi
) 9>"$TEAM_FOLDERS.lock"

docker rm --force "$CONTAINER" >/dev/null 2>&1 || true
exec docker run --rm --name "$CONTAINER" -p "127.0.0.1:$1:80" \
  -e SQLITE_DATABASE=nextcloud -e NEXTCLOUD_ADMIN_USER="$2" -e NEXTCLOUD_ADMIN_PASSWORD="$3" \
  -v "$PWD:/var/www/html/custom_apps/honeycomb:ro" \
  -v "$TEAM_FOLDERS:/var/www/html/custom_apps/groupfolders:ro" \
  -v "$PWD/tests/e2e/nextcloud/post-installation:/docker-entrypoint-hooks.d/post-installation:ro" \
  "$NEXTCLOUD"
