#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Measures the subfolder listing, the picker's count below a folder, the bulk saves and the XMP cache with a tree of 100,000 empty photo files.
# Usage: scripts/measure-scale.sh <port> <admin user>, against a running scripts/e2e-server.sh <port>
set -euo pipefail
cd "$(dirname "$0")/.." || exit 1

source scripts/e2e-names.sh
CONTAINER=$(e2e_container "$1")
USER_ID=$2
FIXTURE=scale-fixture
YEARS=10
DAYS_PER_YEAR=100
PAIRS_PER_DAY=50
SAVED_ITEMS=(2000 60000)
CACHED_ROWS=(5000 50000)

as_web() { docker exec -u www-data "$CONTAINER" "$@"; }

as_web sh -c "
  set -e
  cd /var/www/html/data/$USER_ID/files
  rm -rf './${FIXTURE:?}'
  for y in \$(seq $YEARS); do for d in \$(seq $DAYS_PER_YEAR); do
    mkdir -p $FIXTURE/y\$y/d\$d
    for i in \$(seq $PAIRS_PER_DAY); do : > $FIXTURE/y\$y/d\$d/IMG_\$i.jpg; : > $FIXTURE/y\$y/d\$d/IMG_\$i.cr2; done
  done; done"
as_web php occ files:scan "$USER_ID" --path="$USER_ID/files/$FIXTURE" >/dev/null
trap 'as_web php occ config:system:delete query_log_file >/dev/null' EXIT
as_web php occ config:system:set query_log_file --value=/tmp/honeycomb-query.log >/dev/null
docker cp scripts/measure-scale.php "$CONTAINER:/tmp/measure-scale.php"

for path in "$FIXTURE/y1/d1" "$FIXTURE/y1" "$FIXTURE"; do
  for action in listing pictures-below count-below; do
    as_web php /tmp/measure-scale.php "$USER_ID" "$action" "/$path"
  done
done
for kind in decisions tags; do
  for count in "${SAVED_ITEMS[@]}"; do
    as_web php /tmp/measure-scale.php "$USER_ID" "$kind" "$count" "$FIXTURE"
  done
done
for count in "${CACHED_ROWS[@]}"; do
  for kind in xmp-save xmp-lookup; do
    as_web php /tmp/measure-scale.php "$USER_ID" "$kind" "$count" "$FIXTURE"
  done
done
