#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 honeycomb contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Sourced: the ports and the resource names of one e2e run; the port keeps parallel runs apart.
E2E_DEFAULT_PORT=8180

e2e_port() { echo "${HONEYCOMB_E2E_PORT:-$E2E_DEFAULT_PORT}"; }
# verify.sh runs the oldest-Nextcloud e2e alongside; the offset keeps it clear of other worktrees' 8xxx ports.
E2E_OLDEST_PORT_OFFSET=1000
e2e_oldest_port() { echo "${HONEYCOMB_E2E_OLDEST_PORT:-$(($(e2e_port) + E2E_OLDEST_PORT_OFFSET))}"; }
e2e_container() { echo "honeycomb-e2e-$1"; }
# The label names the process that owns a container, so verify.sh can remove it once that process is gone.
E2E_OWNER_LABEL=honeycomb.e2e.owner
e2e_owner_label() { echo "$E2E_OWNER_LABEL=${HONEYCOMB_E2E_OWNER:-$$@$(uname -n)}"; }
