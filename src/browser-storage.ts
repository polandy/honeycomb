// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The browser's storage; reaching it throws where site data is blocked. */
export type BrowserStorage = () => Pick<Storage, 'getItem' | 'setItem'>

/** The stored value, or null when there is none or no storage. */
export function readStored(storage: BrowserStorage, key: string): string | null {
	try {
		return storage().getItem(key)
	} catch {
		return null
	}
}

/** Stores the value for the next visit; without site data it lasts for this visit only. */
export function writeStored(storage: BrowserStorage, key: string, value: string) {
	try {
		storage().setItem(key, value)
	} catch {
		// The caller's state holds the value for this visit.
	}
}
