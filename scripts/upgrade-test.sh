#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Saves data with the first release, updates to this checkout and checks the data survived or was
# carried as designed: the decision becomes the start value of the statistics (ADR 0039, ADR 0040).
# Usage: scripts/upgrade-test.sh [port]; the port defaults to HONEYCOMB_UPGRADE_PORT, then 8190.
# HONEYCOMB_DB picks the database: sqlite (default), mariadb or postgres (scripts/database.sh).
set -euo pipefail
cd "$(dirname "$0")/.." || exit 1
source scripts/nextcloud-images.sh
source scripts/e2e-names.sh
source scripts/database.sh

FROM=v0.1.0
PORT=${1:-$(upgrade_port)}
CONTAINER=$(upgrade_container "$PORT")
BASE=http://localhost:$PORT
ACCOUNT=admin
PASSWORD=upgrade-test-password
STARTUP_SECONDS=300
FOLDER=upgrade
PHOTO=tests/fixtures/images/landscape-600x400.jpg
DECISION='{"rating":4,"colourLabel":"red","flag":"picked","keepRaw":false}'
TAGS='["upgrade/kept"]'
SETTINGS='{"upgradeTest":true}'

app=$(mktemp -d)
jar=$(mktemp)
cleanup() {
  docker rm --force "$CONTAINER" >/dev/null 2>&1 || true
  database_stop "$PORT"
  rm -rf "${app:?}" "${jar:?}"
}
trap cleanup EXIT

fail() {
  echo "FAIL $1" >&2
  exit 1
}

occ() {
  docker exec -u www-data "$CONTAINER" php occ "$@"
}

# Like Playwright's webServer: wait until Nextcloud answers, at most STARTUP_SECONDS.
wait_for_nextcloud() {
  curl -fs -o /dev/null --retry "$STARTUP_SECONDS" --retry-delay 1 --retry-all-errors \
    --retry-max-time "$STARTUP_SECONDS" "$BASE/status.php"
}

# Calls the honeycomb API as ACCOUNT: <method> <path> [json body].
api() {
  local token
  token=$(curl -fsS -u "$ACCOUNT:$PASSWORD" -b "$jar" -c "$jar" "$BASE/index.php/csrftoken" | jq -r .token)
  curl -fsS -u "$ACCOUNT:$PASSWORD" -b "$jar" -c "$jar" -H "requesttoken: $token" \
    -H 'Content-Type: application/json' -X "$1" "$BASE/index.php/apps/honeycomb/api/v1/$2" ${3:+--data "$3"}
}

# Prints the data v0.1.0 stored for FILE_ID.
stored() {
  jq -cS '.decisions[0] | del(.fileId)' <<<"$(api POST decisions/lookup "{\"fileIds\":[$FILE_ID]}")"
  jq -cS '.tags[0].tags' <<<"$(api POST tags/lookup "{\"fileIds\":[$FILE_ID]}")"
  jq -cS '.settings' <<<"$(api GET settings)"
}

# Copies the app at <ref>, or the working tree without a ref, into the mounted app folder.
install_app() {
  find "$app" -mindepth 1 -delete
  if [ $# -gt 0 ]; then
    git archive "$1" | tar -x -C "$app"
  else
    git ls-files -z | tar --null -T - -c | tar -x -C "$app"
  fi
  chmod -R a+rX "$app"
}

git rev-parse -q --verify "refs/tags/$FROM" >/dev/null || git fetch -q --depth=1 origin tag "$FROM"
old_version=$(git show "$FROM:appinfo/info.xml" | sed -nE 's|.*<version>(.*)</version>.*|\1|p')
new_version=$(sed -nE 's|.*<version>(.*)</version>.*|\1|p' appinfo/info.xml)

install_app "$FROM"
docker rm --force "$CONTAINER" >/dev/null 2>&1 || true
database_stop "$PORT"
database_start "$PORT"
docker run --detach --rm --name "$CONTAINER" -p "127.0.0.1:$PORT:80" --label "$(e2e_owner_label)" \
  "${DATABASE_DOCKER_ARGS[@]}" -e NEXTCLOUD_ADMIN_USER="$ACCOUNT" -e NEXTCLOUD_ADMIN_PASSWORD="$PASSWORD" \
  -v "$app:/var/www/html/custom_apps/honeycomb" "$NEWEST_NEXTCLOUD_IMAGE" >/dev/null
wait_for_nextcloud || fail "Nextcloud did not answer within $STARTUP_SECONDS seconds"
occ app:enable honeycomb >/dev/null

curl -fsS -u "$ACCOUNT:$PASSWORD" -X MKCOL "$BASE/remote.php/dav/files/$ACCOUNT/$FOLDER"
curl -fsS -u "$ACCOUNT:$PASSWORD" -T "$PHOTO" "$BASE/remote.php/dav/files/$ACCOUNT/$FOLDER/$(basename "$PHOTO")"
FILE_ID=$(api GET "entries?path=$FOLDER" | jq -er '.. | objects | .fileId? // empty' | head -n 1)
api PUT decisions "{\"decisions\":[$(jq -c ".fileId = $FILE_ID" <<<"$DECISION")]}"
api PUT tags "{\"tags\":[{\"fileId\":$FILE_ID,\"tags\":$TAGS}]}"
api PUT settings "{\"settings\":$SETTINGS}" >/dev/null
before=$(stored)
[ "$before" = "$(jq -cS . <<<"$DECISION"; jq -cS . <<<"$TAGS"; jq -cS . <<<"$SETTINGS")" ] ||
  fail "$FROM did not store the data: $before"

# Every release raises the version; an unreleased checkout may still carry the old one.
if [ "$new_version" = "$old_version" ]; then
  new_version=$old_version.1
fi
install_app
sed -i -E "s|<version>.*</version>|<version>$new_version</version>|" "$app/appinfo/info.xml"
occ upgrade --no-interaction >/dev/null
# A restart drops the PHP code Apache cached from the old release.
docker restart "$CONTAINER" >/dev/null
wait_for_nextcloud || fail "Nextcloud did not answer within $STARTUP_SECONDS seconds"

[ "$(occ app:list --output=json | jq -r '.enabled.honeycomb')" = "$new_version" ] ||
  fail "honeycomb $new_version is not enabled after the update"
settings=$(jq -cS '.settings' <<<"$(api GET settings)")
[ "$settings" = "$(jq -cS . <<<"$SETTINGS")" ] || fail "the update changed the settings: $settings"
# honeycomb_decisions and honeycomb_file_tags are dropped; the one decided picture is the start value.
decided=$(occ user:setting "$ACCOUNT" honeycomb pictures_decided_before | jq -r .count)
[ "$decided" = 1 ] || fail "the update did not count the decided picture: $decided"
# The listing reads tables later releases added, so it fails when a migration did not run.
flag=$(api GET "entries?path=$FOLDER" | jq -c "[.. | objects | select(.fileId? == $FILE_ID) | .flag]") ||
  fail "the folder does not open after the update"
[ "$flag" = '[null]' ] || fail "the photo carries a flag nobody set after the update: $flag"
echo "ok   update from $FROM to $new_version kept the data"
