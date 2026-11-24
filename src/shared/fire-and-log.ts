// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { logger } from './logger.ts'

/** Starts work nobody awaits; a rejection is logged with `what`, never dropped. */
export function fireAndLog(work: Promise<unknown>, what: string): void {
	work.catch((error: unknown) => logger.error(what, { error }))
}
