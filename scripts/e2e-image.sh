#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Loads the pinned e2e Nextcloud image from an archive, so CI never waits on a live Docker Hub pull.
# Usage: scripts/e2e-image.sh <archive>; prints the local tag for HONEYCOMB_E2E_IMAGE.
# Without the archive it pulls the pinned image once, saves it and loads it back from the archive,
# so the server starts from what the cache will hold. HONEYCOMB_E2E_NEXTCLOUD picks oldest or newest.
set -euo pipefail
cd "$(dirname "$0")/.." || exit 1

source scripts/nextcloud-images.sh
NEXTCLOUD=${HONEYCOMB_E2E_NEXTCLOUD:-newest}
PINNED=$(e2e_nextcloud_image "$NEXTCLOUD")
TAG=$(e2e_cached_image_tag "$NEXTCLOUD")
ARCHIVE=$1

if [ ! -f "$ARCHIVE" ]; then
  mkdir -p "$(dirname "$ARCHIVE")"
  docker pull "$PINNED" >&2
  # A loaded archive keeps tags, not the registry digest, so the digest goes into the tag.
  docker tag "$PINNED" "$TAG"
  docker save --output "$ARCHIVE.part" "$TAG"
  mv "$ARCHIVE.part" "$ARCHIVE"
  docker rmi "$TAG" "$PINNED" >&2
fi
docker load --input "$ARCHIVE" >&2
docker image inspect "$TAG" >/dev/null
echo "$TAG"
