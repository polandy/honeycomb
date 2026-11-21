// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** Whether `next` holds every item of `previous` in place and only adds after them, as a loaded page does. */
export function isAppended<T>(previous: readonly T[], next: readonly T[]): boolean {
	return previous.length <= next.length && previous.every((item, index) => next[index] === item)
}
