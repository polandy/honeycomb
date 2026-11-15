#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Table test for scripts/nextcloud-versions.sh: info.xml and the image list in, pass or fail out.
set -uo pipefail
cd "$(dirname "$0")" || exit 1

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
DIGEST=sha256:3d3c42e5aac5ba805825da76410c181273ba90b13d3c42e5aac5ba80

failed=0
expect() {
  local name=$1 want=$2 dependency=$3 oldest=$4 newest=$5 got
  find "$work" -mindepth 1 -delete && mkdir -p "$work/appinfo" "$work/scripts"
  printf '<info>\n\t<dependencies>\n\t\t%s\n\t</dependencies>\n</info>\n' "$dependency" >"$work/appinfo/info.xml"
  if [ -n "$oldest$newest" ]; then
    printf 'OLDEST_NEXTCLOUD_IMAGE=nextcloud:%s-apache@%s\nNEWEST_NEXTCLOUD_IMAGE=nextcloud:%s-apache@%s\n' \
      "$oldest" "$DIGEST" "$newest" "$DIGEST" >"$work/scripts/nextcloud-images.sh"
  fi
  if (cd "$work" && "$OLDPWD/nextcloud-versions.sh") >/dev/null 2>&1; then got=pass; else got=fail; fi
  if [ "$got" != "$want" ]; then
    echo "FAIL $name: want $want got $got"
    failed=1
  fi
}

expect one-major pass '<nextcloud min-version="35" max-version="35"/>' 35.0.0 35.0.3
expect two-majors pass '<nextcloud min-version="35" max-version="36"/>' 35.0.0 36.0.1
expect no-max-version fail '<nextcloud min-version="35"/>' 35.0.0 35.0.3
expect no-min-version fail '<nextcloud max-version="35"/>' 35.0.0 35.0.3
expect max-raised-without-image fail '<nextcloud min-version="35" max-version="36"/>' 35.0.0 35.0.3
expect min-lowered-without-image fail '<nextcloud min-version="34" max-version="35"/>' 35.0.0 35.0.3
expect oldest-not-first-release fail '<nextcloud min-version="35" max-version="35"/>' 35.0.1 35.0.3
expect image-past-max fail '<nextcloud min-version="35" max-version="35"/>' 35.0.0 36.0.0
expect no-image-list fail '<nextcloud min-version="35" max-version="35"/>' '' ''

exit $failed
