#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Sourced: the ports and the resource names of one e2e or upgrade run; the port keeps parallel runs apart.
E2E_DEFAULT_PORT=8180
UPGRADE_DEFAULT_PORT=8190

e2e_port() { echo "${HONEYCOMB_E2E_PORT:-$E2E_DEFAULT_PORT}"; }
upgrade_port() { echo "${HONEYCOMB_UPGRADE_PORT:-$UPGRADE_DEFAULT_PORT}"; }
e2e_container() { echo "honeycomb-e2e-$1"; }
upgrade_container() { echo "honeycomb-upgrade-$1"; }
