#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Table test for scripts/e2e-image.sh against a fake docker that logs its calls.
set -uo pipefail
cd "$(dirname "$0")" || exit 1
source ./nextcloud-images.sh

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir "$work/bin"
cat >"$work/bin/docker" <<'FAKE'
#!/usr/bin/env bash
echo "$*" >>"$FAKE_DOCKER_LOG"
case "$1" in
  pull) [ -z "${FAKE_DOCKER_PULL_FAILS:-}" ] ;;
  save) echo image >"$3" ;;
  image) [ -z "${FAKE_DOCKER_LOAD_FAILS:-}" ] ;;
esac
FAKE
chmod +x "$work/bin/docker"
export PATH="$work/bin:$PATH" FAKE_DOCKER_LOG="$work/log"
OLDEST_TAG=honeycomb-e2e-nextcloud:${OLDEST_NEXTCLOUD_IMAGE##*sha256:}
NEWEST_TAG=honeycomb-e2e-nextcloud:${NEWEST_NEXTCLOUD_IMAGE##*sha256:}

failed=0
# Runs e2e-image.sh with the archive present or not and compares status, printed tag and docker calls.
expect() {
  local name=$1 nextcloud=$2 archived=$3 want_status=$4 want_tag=$5 want_calls=$6 got_tag status=0
  rm -f "$work/log" "$work/image.tar" && touch "$work/log"
  [ "$archived" = yes ] && echo image >"$work/image.tar"
  got_tag=$(HONEYCOMB_E2E_NEXTCLOUD=$nextcloud ./e2e-image.sh "$work/image.tar" 2>/dev/null) || status=1
  local got_calls
  got_calls=$(paste -sd ';' "$work/log")
  if [ "$status" != "$want_status" ] || [ "$got_tag" != "$want_tag" ] || [ "$got_calls" != "$want_calls" ]; then
    echo "FAIL $name: want $want_status '$want_tag' '$want_calls'"
    echo "            got $status '$got_tag' '$got_calls'"
    failed=1
  fi
}

A=$work/image.tar
expect cached-image-loads-without-pull oldest yes 0 "$OLDEST_TAG" \
  "load --input $A;image inspect $OLDEST_TAG"
expect missing-archive-pulls-saves-and-starts-from-the-archive oldest no 0 "$OLDEST_TAG" \
  "pull $OLDEST_NEXTCLOUD_IMAGE;tag $OLDEST_NEXTCLOUD_IMAGE $OLDEST_TAG;save --output $A.part $OLDEST_TAG;rmi $OLDEST_TAG $OLDEST_NEXTCLOUD_IMAGE;load --input $A;image inspect $OLDEST_TAG"
expect newest-image-by-its-own-digest newest yes 0 "$NEWEST_TAG" \
  "load --input $A;image inspect $NEWEST_TAG"
FAKE_DOCKER_PULL_FAILS=1 expect failed-pull-leaves-no-archive oldest no 1 "" \
  "pull $OLDEST_NEXTCLOUD_IMAGE"
[ -e "$A" ] && echo "FAIL failed-pull-leaves-no-archive: $A exists" && failed=1
FAKE_DOCKER_LOAD_FAILS=1 expect archive-without-the-image-fails oldest yes 1 "" \
  "load --input $A;image inspect $OLDEST_TAG"
expect unknown-nextcloud-fails latest yes 1 "" ""

# The server runs the loaded tag and never pulls it; without a tag it runs the pinned image.
got=$(HONEYCOMB_E2E_IMAGE=$OLDEST_TAG bash -c 'source ./nextcloud-images.sh && e2e_server_image oldest')
[ "$got" != "--pull never $OLDEST_TAG" ] && echo "FAIL server-uses-cached-image: got '$got'" && failed=1
got=$(HONEYCOMB_E2E_IMAGE='' bash -c 'source ./nextcloud-images.sh && e2e_server_image newest')
[ "$got" != "$NEWEST_NEXTCLOUD_IMAGE" ] && echo "FAIL server-pins-image-locally: got '$got'" && failed=1

exit $failed
