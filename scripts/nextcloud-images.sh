#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# The Nextcloud images e2e runs on: the first release of min-version and the newest passing one of max-version.
# Sourced by scripts/e2e-server.sh and scripts/e2e-image.sh, checked by scripts/nextcloud-versions.sh.
OLDEST_NEXTCLOUD_IMAGE=nextcloud:35.0.0-apache@sha256:23c101539e295aaf83888c9c1cae7df3fb6ce80b9ea9310248dad46af8c89936
NEWEST_NEXTCLOUD_IMAGE=nextcloud:35.0.3-apache@sha256:8a7a65b8bae82a79568fec2ed9cf3e374a1944eda2a22ebe130d79463336fee3

# Prints the pinned image for oldest or newest.
e2e_nextcloud_image() {
  case "$1" in
    oldest) echo "$OLDEST_NEXTCLOUD_IMAGE" ;;
    newest) echo "$NEWEST_NEXTCLOUD_IMAGE" ;;
    *) echo "HONEYCOMB_E2E_NEXTCLOUD must be oldest or newest" >&2 && return 1 ;;
  esac
}

# Prints the local tag scripts/e2e-image.sh loads the pinned image as, named by its digest.
e2e_cached_image_tag() {
  local image
  image=$(e2e_nextcloud_image "$1") || return 1
  echo "honeycomb-e2e-nextcloud:${image##*sha256:}"
}

# Prints docker run's image arguments: the loaded tag without a pull when HONEYCOMB_E2E_IMAGE names one.
e2e_server_image() {
  if [ -n "${HONEYCOMB_E2E_IMAGE:-}" ]; then
    echo "--pull never $HONEYCOMB_E2E_IMAGE"
  else
    e2e_nextcloud_image "$1"
  fi
}
