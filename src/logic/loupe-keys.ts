// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** What a key does in the loupe. */
export type LoupeKeyAction = 'previous' | 'next' | 'first' | 'last' | 'close' | 'chrome-free' | 'fullscreen' | 'zoom' | 'info'

/** A key press as the loupe reads it. */
export interface LoupeKeyEvent {
	readonly key: string
	readonly ctrlKey: boolean
	readonly metaKey: boolean
	readonly altKey: boolean
	readonly shiftKey: boolean
}

/** The loupe's keys of the shared key map (`docs/plan.md` Keyboard shortcuts). */
const LOUPE_KEYS: Readonly<Record<string, LoupeKeyAction>> = {
	ArrowLeft: 'previous',
	ArrowRight: 'next',
	Home: 'first',
	End: 'last',
	Escape: 'close',
	Tab: 'chrome-free',
	f: 'fullscreen',
	z: 'zoom',
	' ': 'zoom',
	i: 'info',
}

/** The loupe action of a key without modifiers, or null. */
export function loupeKey(event: LoupeKeyEvent): LoupeKeyAction | null {
	if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
		return null
	}
	return LOUPE_KEYS[event.key.length === 1 ? event.key.toLowerCase() : event.key] ?? null
}
