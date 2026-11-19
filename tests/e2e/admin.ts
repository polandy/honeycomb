// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { RESULTS_DIR } from './server.ts'

/** The admin account the e2e container is installed with. */
export const ADMIN = { username: 'admin', password: 'honeycomb-e2e-admin-password' }

/** Where the login setup leaves the admin's session for the other cases. */
export const ADMIN_STATE = `${RESULTS_DIR}/admin-state.json`
