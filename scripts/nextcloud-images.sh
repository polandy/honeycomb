#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# The Nextcloud images e2e runs on: the first release of min-version and the newest of max-version.
# Sourced by scripts/e2e-server.sh and scripts/upgrade-test.sh, checked by scripts/nextcloud-versions.sh.
OLDEST_NEXTCLOUD_IMAGE=nextcloud:35.0.0-apache@sha256:23c101539e295aaf83888c9c1cae7df3fb6ce80b9ea9310248dad46af8c89936
NEWEST_NEXTCLOUD_IMAGE=nextcloud:35.0.3-apache@sha256:8a7a65b8bae82a79568fec2ed9cf3e374a1944eda2a22ebe130d79463336fee3
