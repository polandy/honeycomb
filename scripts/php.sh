#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Runs a PHP command with the local PHP, or in the pinned composer image when PHP is not installed.
set -euo pipefail
cd "$(dirname "$0")/.." || exit 1

COMPOSER_IMAGE=composer:2.11.1

if command -v php >/dev/null 2>&1; then
  exec "$@"
fi
exec docker run --rm -u "$(id -u):$(id -g)" -e COMPOSER_HOME=/tmp/composer \
  -v "$PWD":/app -w /app "$COMPOSER_IMAGE" "$@"
