#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Fails on an export in src/ that no other file imports (docs/conventions.md §1).
set -euo pipefail
cd "$(dirname "$0")/.."
exec node scripts/unused-exports/cli.ts
