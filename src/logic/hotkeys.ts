// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DecisionIntent } from './decision-change.ts'
import type { ColourLabel } from './decision.ts'

/** A key press as the key map reads it; `capsLock` from `getModifierState('CapsLock')`. */
export interface HotkeyEvent {
	readonly key: string
	readonly code: string
	readonly ctrlKey: boolean
	readonly metaKey: boolean
	readonly altKey: boolean
	readonly shiftKey: boolean
	readonly capsLock: boolean
}

/** Whether the vi keys are on, and whether a first `g` waits for the second. */
export interface HotkeyState {
	readonly vi: boolean
	readonly pendingG: boolean
}

/** What a decision key asks for; a rating step resolves against the target's rating. */
export type HotkeyIntent = DecisionIntent | { readonly kind: 'ratingStep', readonly step: 1 | -1 }

/** The keys that act without deciding. */
export type HotkeyCommand
	= | 'previous' | 'next' | 'up' | 'down' | 'first' | 'last'
		| 'grid' | 'loupe' | 'zoom' | 'zoom-in' | 'zoom-out' | 'fullscreen' | 'header' | 'info' | 'close' | 'flag-buttons'
		| 'filter-bar' | 'filters-off' | 'filter-focus' | 'select-all' | 'select-none'
		| 'undo' | 'redo' | 'shortcuts'

/** What a key does: decide (and maybe go to the next photo) or run a command. */
export type HotkeyAction
	= | { readonly kind: 'decide', readonly intent: HotkeyIntent, readonly advance: boolean }
		| { readonly kind: HotkeyCommand }

/** The groups of the shortcut sheet, in its order. */
export type KeymapGroup = 'flags' | 'rating' | 'views' | 'filter' | 'undo' | 'vi'

/** One row of the shortcut sheet: its keys as the user doc writes them; `range` shows the two as "from – to". */
export interface KeymapEntry {
	readonly id: string
	readonly group: KeymapGroup
	readonly caps: readonly string[]
	readonly range?: boolean
}

/** The keys honeycomb has a function for (`docs/plan.md` Keyboard shortcuts); a later milestone adds its keys here. */
export const KEYMAP: readonly KeymapEntry[] = [
	{ id: 'pick', group: 'flags', caps: ['P'] },
	{ id: 'reject', group: 'flags', caps: ['X'] },
	{ id: 'unflag', group: 'flags', caps: ['U'] },
	{ id: 'flag-next', group: 'flags', caps: ['Shift+P', 'Shift+X', 'Shift+U'] },
	{ id: 'auto-advance', group: 'flags', caps: ['Caps Lock'] },
	{ id: 'toggle-pick', group: 'flags', caps: ['`'] },
	{ id: 'flag-buttons', group: 'flags', caps: ['B'] },
	{ id: 'rating', group: 'rating', caps: ['0', '5'], range: true },
	{ id: 'rating-next', group: 'rating', caps: ['Shift+0', 'Shift+5'], range: true },
	{ id: 'star-down', group: 'rating', caps: ['['] },
	{ id: 'star-up', group: 'rating', caps: [']'] },
	{ id: 'colour-label', group: 'rating', caps: ['6', '7', '8', '9'] },
	{ id: 'keep-raw', group: 'rating', caps: ['R'] },
	{ id: 'arrows', group: 'views', caps: ['←', '→', '↑', '↓'] },
	{ id: 'first-last', group: 'views', caps: ['Home', 'End'] },
	{ id: 'open', group: 'views', caps: ['Enter'] },
	{ id: 'grid', group: 'views', caps: ['G'] },
	{ id: 'loupe', group: 'views', caps: ['E'] },
	{ id: 'zoom', group: 'views', caps: ['Space', 'Z'] },
	{ id: 'zoom-in', group: 'views', caps: ['Ctrl+='] },
	{ id: 'zoom-out', group: 'views', caps: ['Ctrl+-'] },
	{ id: 'fullscreen', group: 'views', caps: ['F'] },
	{ id: 'header', group: 'views', caps: ['Tab'] },
	{ id: 'info', group: 'views', caps: ['I'] },
	{ id: 'close', group: 'views', caps: ['Esc'] },
	{ id: 'filter-bar', group: 'filter', caps: ['\\'] },
	{ id: 'filters-off', group: 'filter', caps: ['Ctrl+L'] },
	{ id: 'select-all', group: 'filter', caps: ['Ctrl+A'] },
	{ id: 'select-none', group: 'filter', caps: ['Ctrl+D'] },
	{ id: 'undo', group: 'undo', caps: ['Ctrl+Z'] },
	{ id: 'redo', group: 'undo', caps: ['Ctrl+Shift+Z'] },
	{ id: 'shortcuts', group: 'undo', caps: ['Ctrl+/', '?'] },
	{ id: 'vi-sideways', group: 'vi', caps: ['h', 'l'] },
	{ id: 'vi-rows', group: 'vi', caps: ['j', 'k'] },
	{ id: 'vi-first', group: 'vi', caps: ['g g'] },
	{ id: 'vi-last', group: 'vi', caps: ['Shift+G'] },
	{ id: 'vi-filter', group: 'vi', caps: ['/'] },
	{ id: 'vi-grid', group: 'vi', caps: ['Esc'] },
]

/** No vi keys and no waiting `g`. */
export const NO_HOTKEY_STATE: HotkeyState = { vi: false, pendingG: false }

/** A key cap as shown, with `Ctrl` as `⌘` on a Mac. */
export function formatCaps(caps: string, mac: boolean): string {
	return mac ? caps.replace(/\bCtrl\b/, '⌘') : caps
}

/** The rating one star up or down, within 0 to 5; a mixed rating starts at 0. */
export function stepRating(rating: number | undefined, step: 1 | -1): number {
	return Math.min(5, Math.max(0, (rating ?? 0) + step))
}

const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'CapsLock'])
const FLAGS: Readonly<Record<string, 'picked' | 'rejected' | 'unflagged'>> = { p: 'picked', x: 'rejected', u: 'unflagged', '`': 'picked' }
const LABELS: Readonly<Record<string, ColourLabel>> = { 6: 'red', 7: 'yellow', 8: 'green', 9: 'blue' }
const COMMANDS: Readonly<Record<string, HotkeyCommand>> = {
	ArrowLeft: 'previous',
	ArrowRight: 'next',
	ArrowUp: 'up',
	ArrowDown: 'down',
	Home: 'first',
	End: 'last',
	g: 'grid',
	e: 'loupe',
	' ': 'zoom',
	z: 'zoom',
	f: 'fullscreen',
	Tab: 'header',
	i: 'info',
	'\\': 'filter-bar',
	Escape: 'close',
	b: 'flag-buttons',
	'?': 'shortcuts',
}
const CTRL_COMMANDS: Readonly<Record<string, HotkeyCommand>> = { a: 'select-all', d: 'select-none', l: 'filters-off', z: 'undo', '=': 'zoom-in', '+': 'zoom-in', '-': 'zoom-out', '/': 'shortcuts' }
const VI_COMMANDS: Readonly<Record<string, HotkeyCommand>> = { h: 'previous', l: 'next', j: 'down', k: 'up', '/': 'filter-focus' }

const decide = (intent: HotkeyIntent, advance: boolean): HotkeyAction => ({ kind: 'decide', intent, advance })
const command = (kind: HotkeyCommand | undefined): HotkeyAction | null => (kind === undefined ? null : { kind })

/** The action of a key with Ctrl or ⌘; Shift only turns undo into redo or comes with a layout's `+` or `/`. */
function ctrlKey(event: HotkeyEvent, key: string): HotkeyAction | null {
	if (key === 'z') {
		return command(event.shiftKey ? 'redo' : 'undo')
	}
	return event.shiftKey && !['+', '/'].includes(key) ? null : command(CTRL_COMMANDS[key])
}

/** The action of a key with Shift: decide and go to the next photo, or the help sheet. */
function shiftKey(event: HotkeyEvent, key: string): HotkeyAction | null {
	const digit = /^Digit([0-5])$/.exec(event.code)
	if (digit !== null) {
		return decide({ kind: 'rating', rating: Number(digit[1]) }, true)
	}
	const flag = key === '`' ? undefined : FLAGS[key]
	return flag !== undefined ? decide({ kind: 'flag', flag }, true) : command(key === '?' ? 'shortcuts' : undefined)
}

/** The action of a key without modifiers; Caps Lock makes every decision but Keep RAW advance. */
function plainKey(event: HotkeyEvent, key: string): HotkeyAction | null {
	const advance = event.capsLock
	if (FLAGS[key] !== undefined) {
		return decide({ kind: 'flag', flag: FLAGS[key] }, advance)
	}
	if (/^[0-5]$/.test(key)) {
		return decide({ kind: 'rating', rating: Number(key) }, advance)
	}
	if (LABELS[key] !== undefined) {
		return decide({ kind: 'colourLabel', colourLabel: LABELS[key] }, advance)
	}
	if (key === '[' || key === ']') {
		return decide({ kind: 'ratingStep', step: key === ']' ? 1 : -1 }, advance)
	}
	return key === 'r' ? decide({ kind: 'keepRaw' }, false) : command(COMMANDS[key])
}

/** The vi meaning of a key, `'prefix'` for a first `g`, or null to act as usual. */
function viKey(event: HotkeyEvent, key: string, pendingG: boolean): HotkeyAction | 'prefix' | null {
	if (key === 'g') {
		return event.shiftKey ? command('last') : pendingG ? command('first') : 'prefix'
	}
	return event.shiftKey ? null : command(VI_COMMANDS[key])
}

/** What a key does (`docs/plan.md` Keyboard shortcuts, Vi keys) and the state for the next key. */
export function hotkey(event: HotkeyEvent, state: HotkeyState): { action: HotkeyAction | null, state: HotkeyState } {
	if (MODIFIERS.has(event.key)) {
		return { action: null, state }
	}
	const next = { ...state, pendingG: false }
	const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
	if (event.altKey) {
		return { action: null, state: next }
	}
	if (event.ctrlKey || event.metaKey) {
		return { action: ctrlKey(event, key), state: next }
	}
	const vi = state.vi ? viKey(event, key, state.pendingG) : null
	if (vi === 'prefix') {
		return { action: null, state: { ...state, pendingG: true } }
	}
	if (vi !== null) {
		return { action: vi, state: next }
	}
	return { action: event.shiftKey ? shiftKey(event, key) : plainKey(event, key), state: next }
}
