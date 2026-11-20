#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Reads sidecars honeycomb writes back with ExifTool and Exiv2 (tests/interop), in a container with both tools.
set -euo pipefail
cd "$(dirname "$0")/.." || exit 1

XMP_INTEROP_IMAGE=node:24.22.3-trixie-slim@sha256:af02d57b57719b9657a45199a79264a9437940cd55b3c7b3fc99615654f124a0
TAG=honeycomb-xmp-interop

docker build --quiet --tag "$TAG" --build-arg "BASE=$XMP_INTEROP_IMAGE" tests/interop > /dev/null
run() {
  docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:$PWD" -w "$PWD" "$TAG" "$@"
}
# The tool versions name what the nightly run proved against.
run sh -c 'echo "exiftool $(exiftool -ver), $(exiv2 --version | head -n 1)"'
run npx vitest run --config vitest.interop.config.ts
