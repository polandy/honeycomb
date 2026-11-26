// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** Whether `next` holds every item of `previous` in place and only adds after them, as a loaded page does. */
export function isAppended<T>(previous: readonly T[], next: readonly T[]): boolean {
	return previous.length <= next.length && previous.every((item, index) => next[index] === item)
}

/** Whether `next` is `previous` without some of its items and not empty, the rest in order, as when the filters refuse a decided photo. */
export function isRemoval<T>(previous: readonly T[], next: readonly T[]): boolean {
	let at = 0
	return next.length > 0 && next.length < previous.length && next.every((item) => {
		at = previous.indexOf(item, at) + 1
		return at > 0
	})
}
