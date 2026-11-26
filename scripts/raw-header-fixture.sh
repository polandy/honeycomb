#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Writes a RAW header fixture: the header values the parser reads, every other byte zeroed (no image, thumbnail or maker note).
# Usage: scripts/raw-header-fixture.sh <RAW file> <fixture>; only reads the RAW file.
set -euo pipefail
exec node "$(dirname "$0")/raw-header-fixture/cli.ts" "${1:?Usage: scripts/raw-header-fixture.sh <RAW file> <fixture>}" "${2:?Usage: scripts/raw-header-fixture.sh <RAW file> <fixture>}"
