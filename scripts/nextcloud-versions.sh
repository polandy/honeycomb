#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Fails unless CI runs the Nextcloud versions appinfo/info.xml declares (docs/user/admin/updating.md).
set -uo pipefail

IMAGES=scripts/nextcloud-images.sh
dependency=$(grep -o '<nextcloud [^>]*>' appinfo/info.xml)
min=$(sed -nE 's/.*min-version="([0-9]+)".*/\1/p' <<<"$dependency")
max=$(sed -nE 's/.*max-version="([0-9]+)".*/\1/p' <<<"$dependency")
oldest=$(sed -nE 's/^OLDEST_NEXTCLOUD_IMAGE=nextcloud:([0-9.]+)-.*/\1/p' "$IMAGES" 2>/dev/null)
newest=$(sed -nE 's/^NEWEST_NEXTCLOUD_IMAGE=nextcloud:([0-9]+)\..*/\1/p' "$IMAGES" 2>/dev/null)

failed=0
report() {
  echo "$1"
  failed=1
}

[ -n "$min" ] || report "appinfo/info.xml: <nextcloud> has no whole-major min-version"
[ -n "$max" ] || report "appinfo/info.xml: <nextcloud> has no whole-major max-version"
[ "$oldest" = "$min.0.0" ] || report "$IMAGES: OLDEST_NEXTCLOUD_IMAGE is '$oldest', want $min.0.0, the first release of min-version"
[ "$newest" = "$max" ] || report "$IMAGES: NEWEST_NEXTCLOUD_IMAGE is major '$newest', want $max, the max-version"

exit $failed
