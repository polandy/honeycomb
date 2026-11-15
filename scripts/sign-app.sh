#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Writes <app-dir>/appinfo/signature.json with occ integrity:sign-app in a throwaway Nextcloud container.
# Usage: scripts/sign-app.sh <app-dir> <private-key> <certificate>
set -euo pipefail
[ $# -eq 3 ] || {
  echo "Usage: $0 <app-dir> <private-key> <certificate>" >&2
  exit 1
}
# shellcheck source=nextcloud-images.sh
. "$(dirname "$0")/nextcloud-images.sh"

# occ needs an installed instance; SQLite in /tmp is enough to sign.
docker run --rm -v "$(realpath "$1"):/app" -v "$(realpath "$2"):/keys/app.key:ro" \
  -v "$(realpath "$3"):/keys/app.crt:ro" --entrypoint sh "$NEWEST_NEXTCLOUD_IMAGE" -c '
  set -e
  cp -a /usr/src/nextcloud /tmp/nc && chown -R www-data /tmp/nc /app
  install -o www-data -m 400 /keys/app.key /keys/app.crt /tmp/
  status=0
  su -s /bin/sh www-data -c "cd /tmp/nc &&
    php occ maintenance:install --database sqlite --admin-user signer --admin-pass signer -n >/dev/null &&
    php occ integrity:sign-app --path=/app --privateKey=/tmp/app.key --certificate=/tmp/app.crt" || status=$?
  chown -R '"$(id -u):$(id -g)"' /app
  exit $status'
