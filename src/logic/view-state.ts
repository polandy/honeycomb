// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The loupe's per-user state that is not a setting, kept on the server (ADR 0019). */
export interface ViewState {
	infoPanelOpen: boolean
	gestureGuideSeen: boolean
	seriesHintSeen: boolean
}

export type ViewStateKey = keyof ViewState

/** Each key's stored value, null while it was never stored. */
export type StoredViewState = { [Key in ViewStateKey]: boolean | null }

const VIEW_STATE_KEYS: readonly ViewStateKey[] = ['infoPanelOpen', 'gestureGuideSeen', 'seriesHintSeen']

export const DEFAULT_VIEW_STATE: ViewState = { infoPanelOpen: false, gestureGuideSeen: false, seriesHintSeen: false }

export const NOTHING_STORED: StoredViewState = { infoPanelOpen: null, gestureGuideSeen: null, seriesHintSeen: null }

/** What to apply, write and remove from browser storage once the stored view state is known. */
export interface ViewStatePlan {
	apply: Partial<ViewState>
	upload: Partial<ViewState>
	remove: ViewStateKey[]
}

/** The server's answer with anything but a boolean read as never stored. */
export function parseViewState(answer: unknown): StoredViewState {
	const record = typeof answer === 'object' && answer !== null ? answer as Record<string, unknown> : {}
	const parsed = { ...NOTHING_STORED }
	for (const key of VIEW_STATE_KEYS) {
		const value = record[key]
		parsed[key] = typeof value === 'boolean' ? value : null
	}
	return parsed
}

/** A value an older version left in browser storage, null unless `true` or `false`. */
export function parseLocalValue(value: string | null): boolean | null {
	return value === 'true' || value === 'false' ? value === 'true' : null
}

/**
 * Per key the stored value wins and a local leftover is removed; a local value the server has
 * never stored applies and is written once; else the default. A key in `changed` is left alone.
 */
export function planViewState(stored: StoredViewState, local: StoredViewState, changed: ReadonlySet<ViewStateKey>): ViewStatePlan {
	const plan: ViewStatePlan = { apply: {}, upload: {}, remove: [] }
	for (const key of VIEW_STATE_KEYS.filter((each) => !changed.has(each))) {
		const own = stored[key]
		const left = local[key]
		if (own !== null) {
			plan.apply[key] = own
			if (left !== null) {
				plan.remove.push(key)
			}
		} else if (left !== null) {
			plan.apply[key] = left
			plan.upload[key] = left
		} else {
			plan.apply[key] = DEFAULT_VIEW_STATE[key]
		}
	}
	return plan
}
