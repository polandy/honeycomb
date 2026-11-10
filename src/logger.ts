// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { getLoggerBuilder } from '@nextcloud/logger'

/** The app's logger, at the user's Nextcloud log level; the frontend never uses `console`. */
export const logger = getLoggerBuilder().setApp('honeycomb').detectUser().build()
