#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Measures the JPEGs of each subfolder of <folder>, one series each, and prints their ranks (docs/dev/calibration.md).
# Usage: scripts/sharpness-calibration.sh <folder>; needs ImageMagick 7 (`magick`) and only reads the folder.
set -euo pipefail
folder=$(realpath "${1:?Usage: scripts/sharpness-calibration.sh <folder>}")
cd "$(dirname "$0")/.."
exec node scripts/sharpness-calibration/cli.ts "$folder"
